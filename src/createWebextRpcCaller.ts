import Browser from 'webextension-polyfill'
import { ExposedPromise } from './utils'
import type {
  B2CMessage,
  C2BMessage,
  PromisifiedRouter,
  RouterRecord,
} from './types'
import { MessageStream } from './utils'
import { createRpcCaller } from './utils/createRpcCaller'
import { DEFAULT_PORT_NAME } from './port_name'

export const createWebextRpcCaller = <T extends RouterRecord>(
  port_name: string = DEFAULT_PORT_NAME
): PromisifiedRouter<T> => {
  return createRpcCaller((calls, args) => {
    const port = Browser.runtime.connect({
      name: port_name,
    })

    const exposedPromise = new ExposedPromise()
    let messageStream: MessageStream<any> | null = null
    function throwError(error_message: string) {
      throw new Error(error_message)
    }
    port.onMessage.addListener((message: B2CMessage) => {
      if (messageStream) {
        if (message.error) {
          throwError(message.error)
        }
        if (!message.done) {
          messageStream.addMessage(message.value)
        }
        //done的逻辑在onDisconnect中处理
        return
      }

      if (message.error) {
        throwError(message.error)
      }

      if (message.isStream) {
        messageStream = new MessageStream()
        messageStream.addMessage(message.value)
        exposedPromise.resolve(messageStream.getMessages())
      }

      exposedPromise.resolve(message.value)
    })

    port.onDisconnect.addListener(() => {
      if (messageStream) {
        messageStream.close()
      }
    })

    port.postMessage({ calls, args } as C2BMessage)
    return exposedPromise.promise
  })
}
