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
import { RpcError } from '../RpcError'
import { MessageStream } from '../utils/MessageStream'

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
  await waitFor(() => !port.connected)
}

async function captureRejection(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the promise to reject')
}

async function drain(iter: AsyncGenerator<unknown>) {
  const received: unknown[] = []
  let thrown: any = null
  try {
    for await (const value of iter) received.push(value)
  } catch (error) {
    thrown = error
  }
  return { received, thrown }
}

beforeEach(() => {
  fake.reset()
})

describe('RpcError', () => {
  it('is a real Error subclass that keeps the code and the original name', () => {
    const cause = new Error('inner')
    const error = new RpcError('REMOTE_ERROR', 'nope', {
      cause,
      name: 'RangeError',
    })

    expect(error).toBeInstanceOf(RpcError)
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('REMOTE_ERROR')
    expect(error.name).toBe('RangeError')
    expect(error.message).toBe('nope')
    expect(error.cause).toBe(cause)
  })
})

describe('stream truncated by a disconnect', () => {
  it('delivers the queued values, then throws PORT_DISCONNECTED', async () => {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 'first' })
    port.emitMessage({ isStream: true, done: false, value: 'second' })
    const iter = await pending

    // The background dies before the terminal { done: true } message.
    port.emitDisconnect()

    const { received, thrown } = await drain(iter)

    expect(received).toEqual(['first', 'second'])
    expect(thrown).toBeInstanceOf(RpcError)
    expect(thrown.code).toBe('PORT_DISCONNECTED')
    expect(thrown.message).toMatch(/streaming RPC call "stream"/)
  })

  it('does not report a failure when the stream ended normally', async () => {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 1 })
    const iter = await pending
    port.emitMessage({ isStream: true, done: true, value: null })

    const { received, thrown } = await drain(iter)

    expect(received).toEqual([1])
    expect(thrown).toBeNull()

    // A disconnect after the terminal message must stay silent.
    port.emitDisconnect()
    expect(thrown).toBeNull()
  })

  it('does not report a failure when the consumer stops early', async () => {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 1 })
    port.emitMessage({ isStream: true, done: false, value: 2 })
    const iter = await pending

    for await (const _value of iter) {
      break
    }

    expect(port.connected).toBe(false)
  })

  it('still delivers queued values when the background reports an error', async () => {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any

    const pending = client.stream()
    port.emitMessage({ isStream: true, done: false, value: 'first' })
    port.emitMessage({ isStream: true, done: false, value: 'second' })
    const iter = await pending

    port.emitMessage({
      error: { message: 'background blew up', name: 'Error' },
    })

    const { received, thrown } = await drain(iter)

    expect(received).toEqual(['first', 'second'])
    expect(thrown).toBeInstanceOf(RpcError)
    expect((thrown as RpcError).code).toBe('REMOTE_ERROR')
    expect((thrown as Error).message).toBe('background blew up')
  })
})

describe('error codes reach the caller', () => {
  function setupClient() {
    const port = createFakePort()
    fake.setConnect(() => port)
    const client = createWebextRpcCaller() as any
    return { port, client }
  }

  it('defaults to REMOTE_ERROR when the background sent no code', async () => {
    const { port, client } = setupClient()

    const pending = client.work()
    port.emitMessage({
      error: { message: 'kaboom', name: 'TypeError', stack: 'at place' },
    })

    const error: any = await captureRejection(pending)

    expect(error).toBeInstanceOf(RpcError)
    expect(error.code).toBe('REMOTE_ERROR')
    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('kaboom')
    expect(error.stack).toBe(
      '[webext-rpc background function error]at place'
    )
  })

  it('passes a background-provided code straight through', async () => {
    const { port, client } = setupClient()

    const pending = client.work()
    port.emitMessage({
      error: {
        message: 'no such function',
        name: 'TypeError',
        code: 'INVALID_PATH',
      },
    })

    const error: any = await captureRejection(pending)

    expect(error.code).toBe('INVALID_PATH')
  })

  it('ignores an unknown code instead of trusting it', async () => {
    const { port, client } = setupClient()

    const pending = client.work()
    port.emitMessage({
      error: { message: 'weird', name: 'Error', code: 'NOT_A_REAL_CODE' },
    })

    const error: any = await captureRejection(pending)

    expect(error.code).toBe('REMOTE_ERROR')
  })

  it('never builds a stack containing the literal string "undefined"', async () => {
    const { port, client } = setupClient()

    const pending = client.work()
    port.emitMessage({ error: { message: 'no stack here', name: 'Error' } })

    const error: any = await captureRejection(pending)

    expect(String(error.stack)).not.toContain('undefined')
  })

  it('rejects calls interrupted before any response with PORT_DISCONNECTED', async () => {
    const { port, client } = setupClient()

    const pending = client.work(1)
    await waitFor(() => port.sent.length === 1)
    port.emitDisconnect()

    const error: any = await captureRejection(pending)

    expect(error).toBeInstanceOf(RpcError)
    expect(error.code).toBe('PORT_DISCONNECTED')
    expect(error.message).toMatch(/disconnected before a response/i)
  })
})

describe('error codes produced by the background', () => {
  it('marks an unknown path as INVALID_PATH', async () => {
    const port = startBackground({})
    await sendToBackground(port, { calls: ['nope'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.code).toBe('INVALID_PATH')
  })

  it('marks a malformed request as INVALID_REQUEST', async () => {
    const port = startBackground({ ping: () => 'pong' })
    await sendToBackground(port, { calls: 'not-an-array', args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.code).toBe('INVALID_REQUEST')
  })

  it('marks a thrown handler error as REMOTE_ERROR', async () => {
    const port = startBackground({
      fail() {
        throw new RangeError('kaboom')
      },
    })

    await sendToBackground(port, { calls: ['fail'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.code).toBe('REMOTE_ERROR')
    expect(port.sent[0].error.name).toBe('RangeError')
  })

  it('serialises a non-Error throw into something readable', async () => {
    const port = startBackground({
      fail() {
        throw { code: 1, why: 'plain object' }
      },
    })

    await sendToBackground(port, { calls: ['fail'], args: [] })

    expect(port.sent).toHaveLength(1)
    expect(port.sent[0].error.message).toBe('{"code":1,"why":"plain object"}')
    expect(port.sent[0].error.code).toBe('REMOTE_ERROR')
  })
})

describe('MessageStream.endWithError', () => {
  it('drains what was queued before raising the failure', async () => {
    const stream = new MessageStream<number>()
    stream.addMessage(1)
    stream.addMessage(2)
    stream.endWithError(new Error('cut short'))

    const { received, thrown } = await drain(stream.getMessages())

    expect(received).toEqual([1, 2])
    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('cut short')
  })

  it('does nothing once the stream was closed normally', async () => {
    const stream = new MessageStream<number>()
    stream.addMessage(1)
    stream.close()

    expect(() => stream.endWithError(new Error('too late'))).not.toThrow()

    const { received, thrown } = await drain(stream.getMessages())

    expect(received).toEqual([1])
    expect(thrown).toBeNull()
  })
})
