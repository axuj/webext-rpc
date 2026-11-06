import Browser from 'webextension-polyfill'
import { ExposedPromise } from './utils'
import type { B2CMessage, RpcRouter, RouterRecord } from './types'
import { MessageStream } from './utils'
import { createRpcCaller } from './utils/createRpcCaller'
import { DEFAULT_PORT_NAME } from './port_name'

export const createWebextRpcCaller = <T extends RouterRecord>(
  port_name: string = DEFAULT_PORT_NAME
): RpcRouter<T> => {
  return createRpcCaller((calls, args) => {
    const port = Browser.runtime.connect({
      name: port_name,
    })

    const exposedPromise = new ExposedPromise()
    let messageStream: MessageStream<any> | null = null
    let settled = false
    let disconnected = false

    const callPath = calls.length > 0 ? calls.join('.') : '<root>'

    const resolveCall = (value: any) => {
      if (settled) return
      settled = true
      exposedPromise.resolve(value)
    }

    const rejectCall = (error: unknown) => {
      if (settled) return
      settled = true
      exposedPromise.reject(error)
    }

    // Disconnecting twice is harmless: the background may already have done it.
    const disconnectPort = () => {
      if (disconnected) return
      disconnected = true
      try {
        port.disconnect()
      } catch {
        // The port is already gone.
      }
    }

    // The caller may stop iterating early; disconnect in that case too. The
    // underlying generator is not consumed until the caller asks for a value.
    const wrapStream = (stream: MessageStream<any>): AsyncGenerator<any> => {
      const generator = stream.getMessages()
      return (async function* () {
        try {
          yield* generator
        } finally {
          disconnectPort()
        }
      })()
    }

    port.onMessage.addListener((rawMessage) => {
      // @types/webextension-polyfill >=0.11 types the listener message as `unknown`
      const message = rawMessage as B2CMessage
      if (message.error) {
        const error = new Error(message.error.message)
        error.stack =
          '[webext-rpc background function error]' + message.error.stack
        error.name = message.error.name

        if (messageStream) {
          // The caller already has the stream: surface the error to the
          // consumer instead of rejecting an already-resolved promise.
          messageStream.error(error)
          return
        }

        rejectCall(error)
        return
      }

      // stream
      if (message.isStream) {
        if (message.done) {
          if (messageStream === null) {
            // The function returned an empty async generator: the first
            // message is already the terminal one.
            const emptyStream = new MessageStream<any>()
            emptyStream.close()
            resolveCall(wrapStream(emptyStream))
            return
          }

          messageStream.close()
          return
        }

        // if messageStream is null, it means we are receiving the first message
        if (messageStream === null) {
          messageStream = new MessageStream()
          messageStream.addMessage(message.value)
          resolveCall(wrapStream(messageStream))
          return
        }

        // if messageStream is not null, it means we are already streaming
        messageStream.addMessage(message.value)
        return
      }

      resolveCall(message.value)
    })

    port.onDisconnect.addListener(() => {
      if (messageStream) {
        messageStream.close()
      }

      if (!settled) {
        rejectCall(
          new Error(
            `Port disconnected before a response for RPC call "${callPath}"`
          )
        )
      }
    })

    try {
      port.postMessage({ calls, args })
    } catch (error) {
      // The port could not even be written to: do not leave the caller hanging.
      rejectCall(error)
      disconnectPort()
    }

    return exposedPromise.promise
  })
}
