import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const onConnectListeners: Array<(port: any) => void> = []
  let connectImpl: ((info: any) => any) | null = null

  return {
    onConnectListeners,
    setConnect(fn: (info: any) => any) {
      connectImpl = fn
    },
    reset() {
      onConnectListeners.length = 0
      connectImpl = null
    },
    runtime: {
      onConnect: {
        addListener(listener: (port: any) => void) {
          onConnectListeners.push(listener)
        },
        removeListener(listener: (port: any) => void) {
          const index = onConnectListeners.indexOf(listener)
          if (index >= 0) onConnectListeners.splice(index, 1)
        },
      },
      connect(info: any) {
        if (!connectImpl) throw new Error('runtime.connect was not stubbed')
        return connectImpl(info)
      },
    },
  }
})

vi.mock('webextension-polyfill', () => ({
  default: { runtime: fake.runtime },
}))

import { createBackgroundHandler } from '../createBackgroundHandler'
import { createWebextRpcCaller } from '../createWebextRpcCaller'
import { createRpcCaller } from '../utils/createRpcCaller'
import { MessageStream } from '../utils/MessageStream'
import { handleCall } from '../utils/handleCall'

type MessageListener = (message: any) => void
type DisconnectListener = () => void

interface FakePort {
  name: string
  connected: boolean
  sent: any[]
  postMessage: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  onMessage: {
    addListener(listener: MessageListener): void
    removeListener(listener: MessageListener): void
  }
  onDisconnect: {
    addListener(listener: DisconnectListener): void
    removeListener(listener: DisconnectListener): void
  }
  emitMessage(message: any): void
  emitDisconnect(): void
}

function createFakePort(name = 'webext-rpc'): FakePort {
  const messageListeners: MessageListener[] = []
  const disconnectListeners: DisconnectListener[] = []

  const port: FakePort = {
    name,
    connected: true,
    sent: [],
    postMessage: vi.fn((message: any) => {
      if (!port.connected) throw new Error('port is disconnected')
      port.sent.push(message)
    }),
    disconnect: vi.fn(() => {
      if (!port.connected) return
      port.connected = false
      for (const listener of [...disconnectListeners]) listener()
    }),
    onMessage: {
      addListener(listener) {
        messageListeners.push(listener)
      },
      removeListener(listener) {
        const index = messageListeners.indexOf(listener)
        if (index >= 0) messageListeners.splice(index, 1)
      },
    },
    onDisconnect: {
      addListener(listener) {
        disconnectListeners.push(listener)
      },
      removeListener(listener) {
        const index = disconnectListeners.indexOf(listener)
        if (index >= 0) disconnectListeners.splice(index, 1)
      },
    },
    emitMessage(message) {
      for (const listener of [...messageListeners]) listener(message)
    },
    emitDisconnect() {
      if (!port.connected) return
      port.connected = false
      for (const listener of [...disconnectListeners]) listener()
    },
  }

  return port
}

async function waitFor(predicate: () => boolean, timeout = 1000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timed out')
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

function startBackground(router: any): FakePort {
  createBackgroundHandler(router)
  const listener = fake.onConnectListeners[fake.onConnectListeners.length - 1]
  if (!listener) throw new Error('background listener was not registered')

  const port = createFakePort()
  listener(port)
  return port
}

async function sendToBackground(port: FakePort, message: any) {
  port.emitMessage(message)
  // The background always disconnects when it is done handling the message.
  await waitFor(() => !port.connected)
}

beforeEach(() => {
  fake.reset()
})

describe('createWebextRpcCaller robustness', () => {
  function setupClient() {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any
    return { port, client }
  }

  it('rejects when the port disconnects before any response (defect 1)', async () => {
    const { port, client } = setupClient()

    const pending = client.ns.work(1)
    await waitFor(() => port.sent.length === 1)
    expect(port.sent[0]).toEqual({ calls: ['ns', 'work'], args: [1] })

    port.emitDisconnect()

    await expect(pending).rejects.toThrow(/disconnected before a response/i)
    await expect(pending).rejects.toThrow(/ns\.work/)
  })

  it('does not reject a call that already resolved before disconnect', async () => {
    const { port, client } = setupClient()

    const pending = client.ns.work()
    port.emitMessage({ isStream: false, value: 'done' })
    port.emitDisconnect()

    await expect(pending).resolves.toBe('done')
  })

  it('errors the consumer when an error arrives mid-stream (defect 2)', async () => {
    const { port, client } = setupClient()

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 'first' })
    const iter = await pending

    port.emitMessage({
      error: { message: 'stream blew up', name: 'Error', stack: '' },
    })

    const received: string[] = []
    await expect(
      (async () => {
        for await (const value of iter) received.push(value)
      })()
    ).rejects.toThrow('stream blew up')

    // A late disconnect must not reject the already-resolved call again.
    port.emitDisconnect()
    expect(received.length).toBeLessThanOrEqual(1)
  })

  it('disconnects the port when the consumer breaks out early (defect 3)', async () => {
    const { port, client } = setupClient()

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 1 })
    port.emitMessage({ isStream: true, done: false, value: 2 })
    const iter = await pending

    for await (const _value of iter) {
      break
    }

    expect(port.disconnect).toHaveBeenCalledTimes(1)
    expect(port.connected).toBe(false)
  })

  it('disconnects the port when the stream completes normally (defect 3)', async () => {
    const { port, client } = setupClient()

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 1 })
    const iter = await pending
    port.emitMessage({ isStream: true, done: true, value: null })

    const received: number[] = []
    for await (const value of iter) received.push(value)

    expect(received).toEqual([1])
    expect(port.disconnect).toHaveBeenCalledTimes(1)
    expect(port.connected).toBe(false)
  })

  it('resolves an empty stream when the first stream message is done', async () => {
    const { port, client } = setupClient()

    const pending = client.empty()
    port.emitMessage({ isStream: true, done: true, value: null })
    const iter = await pending

    const received: unknown[] = []
    for await (const value of iter) received.push(value)

    expect(received).toEqual([])
    // Empty streams are handed to the caller, so a later disconnect is not an error.
    port.emitDisconnect()
  })
})

describe('createRpcCaller proxy traps (defect 4)', () => {
  it('does not treat then, toJSON or symbols as RPC methods', async () => {
    const callback = vi.fn(() => Promise.resolve('unused'))
    const client = createRpcCaller<any>(callback) as any

    expect(client.then).toBeUndefined()
    expect(client.toJSON).toBeUndefined()
    expect(client[Symbol.toStringTag]).toBeUndefined()
    expect(client.nested.then).toBeUndefined()
    expect(client.nested[Symbol.iterator]).toBeUndefined()

    await client
    await Promise.resolve(client)
    // Functions (and function proxies) stringify to undefined, but must not throw
    // and must not be mistaken for an object with a toJSON RPC method.
    expect(() => JSON.stringify(client)).not.toThrow()
    expect(JSON.stringify(client)).toBeUndefined()

    expect(callback).not.toHaveBeenCalled()

    // Real router members still work, including nested namespaces.
    client.nested.method(1, 'two')
    expect(callback).toHaveBeenCalledWith(['nested', 'method'], [1, 'two'])
  })
})

describe('createBackgroundHandler robustness', () => {
  it('still resolves valid nested calls (regression)', async () => {
    const port = startBackground({
      math: {
        add(a: number, b: number) {
          return a + b
        },
      },
    })

    await sendToBackground(port, { calls: ['math', 'add'], args: [1, 2] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0]).toEqual({ isStream: false, value: 3 })
  })

  it('rejects prototype/constructor path segments (defect 5)', async () => {
    const port = startBackground({})

    await sendToBackground(port, {
      calls: ['constructor', 'constructor'],
      args: [],
    })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toMatch(/constructor/i)
  })

  it('rejects __proto__ and prototype path segments (defect 5)', async () => {
    for (const segment of ['__proto__', 'prototype']) {
      const port = startBackground({})
      await sendToBackground(port, { calls: [segment], args: [] })

      expect(port.sent).toHaveLength(1)
      expect(port.sent[0].error.message).toMatch(/not allowed|invalid|forbidden/i)
    }
  })

  it('only follows own properties, not inherited ones (defect 5)', async () => {
    const port = startBackground({})

    await sendToBackground(port, { calls: ['toString'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toMatch(/toString/)
  })

  it('requires the final path value to be a function (defect 5)', async () => {
    const port = startBackground({ foo: { bar: { baz: 1 } } })

    await sendToBackground(port, { calls: ['foo', 'bar'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toMatch(/does not resolve to a function/i)
  })

  it('validates calls and args shapes with clear errors (defect 5)', async () => {
    const invalidCallsPort = startBackground({})
    await sendToBackground(invalidCallsPort, { calls: 'nope', args: [] })
    expect(invalidCallsPort.sent).toHaveLength(1)
    expect(invalidCallsPort.sent[0].error.message).toMatch(
      /calls.*array of strings/i
    )

    const invalidArgsPort = startBackground({ ping: () => 'pong' })
    await sendToBackground(invalidArgsPort, {
      calls: ['ping'],
      args: 'nope',
    })
    expect(invalidArgsPort.sent).toHaveLength(1)
    expect(invalidArgsPort.sent[0].error.message).toMatch(/args.*array/i)
  })

  it('posts a thrown handler error once and does not rethrow (defect 6)', async () => {
    const port = startBackground({
      fail() {
        throw new Error('kaboom')
      },
    })

    await sendToBackground(port, { calls: ['fail'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toBe('kaboom')
    expect(port.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not post an error twice when handleCall already sent one (defect 6)', async () => {
    const port = startBackground({
      weird() {
        return { next: () => ({ done: true, value: undefined }) }
      },
    })

    await sendToBackground(port, { calls: ['weird'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toMatch(/unsupported/i)
    expect(port.disconnect).toHaveBeenCalledTimes(1)
  })

  it('still disconnects when posting the error itself fails (defect 6)', async () => {
    const port = startBackground({
      fail() {
        throw new Error('kaboom')
      },
    })
    port.postMessage.mockImplementation(() => {
      throw new Error('serialization failed')
    })

    port.emitMessage({ calls: ['fail'], args: [] })
    await waitFor(() => !port.connected)

    expect(port.disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('handleCall robustness', () => {
  it('awaits thenables that are not Promise instances (defect 7)', async () => {
    const sendMessage = vi.fn()
    const thenable = {
      then(resolve: (value: string) => void) {
        resolve('thenable value')
      },
    }

    await handleCall(() => thenable, [], sendMessage)

    expect(sendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: 'thenable value',
    })
  })

  it('throws a clear TypeError when the target is not callable (defect 7)', async () => {
    const sendMessage = vi.fn()

    await expect(handleCall(undefined as any, [], sendMessage)).rejects.toThrow(
      TypeError
    )
    await expect(handleCall(undefined as any, [], sendMessage)).rejects.toThrow(
      /not callable/i
    )
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

describe('MessageStream robustness (defect 8)', () => {
  it('lets close be called twice', () => {
    const stream = new MessageStream<number>()
    stream.addMessage(1)

    expect(() => {
      stream.close()
      stream.close()
    }).not.toThrow()
  })

  it('lets error be called twice and rejects the consumer', async () => {
    const stream = new MessageStream<number>()
    const reason = new Error('stream failed')

    expect(() => {
      stream.error(reason)
      stream.error(reason)
    }).not.toThrow()

    await expect(
      (async () => {
        for await (const _value of stream.getMessages()) {
          // no values
        }
      })()
    ).rejects.toThrow('stream failed')
  })

  it('ignores addMessage after close but still delivers queued messages', async () => {
    const stream = new MessageStream<number>()
    stream.addMessage(1)
    stream.close()

    expect(() => stream.addMessage(2)).not.toThrow()

    const received: number[] = []
    for await (const value of stream.getMessages()) received.push(value)

    expect(received).toEqual([1])
  })

  it('ignores addMessage and close after error', async () => {
    const stream = new MessageStream<number>()
    stream.error(new Error('boom'))

    expect(() => {
      stream.addMessage(1)
      stream.close()
    }).not.toThrow()

    await expect(
      (async () => {
        for await (const _value of stream.getMessages()) {
          // no values
        }
      })()
    ).rejects.toThrow('boom')
  })
})
