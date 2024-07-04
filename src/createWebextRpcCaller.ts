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
    port.onMessage.addListener((message: B2CMessage) => {
      if (message.error != undefined) {
        throw new Error(message.error)
      }

      // stream
      if (message.isStream) {
        if (message.done) {
          return
        }

        // if messageStream is null, it means we are receiving the first message
        if (messageStream === null) {
          messageStream = new MessageStream()
          messageStream.addMessage(message.value)
          exposedPromise.resolve(messageStream.getMessages())
          return
        }

        // if messageStream is not null, it means we are already streaming
        messageStream.addMessage(message.value)
        return
      }

      exposedPromise.resolve(message.value)
    })

    port.onDisconnect.addListener(() => {
      if (messageStream) {
        messageStream.close()
      }
    })

    port.postMessage({ calls, args })
    return exposedPromise.promise
  })
}
