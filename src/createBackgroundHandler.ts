import Browser from 'webextension-polyfill'
import { C2BMessage, RouterRecord } from './types'
import { handleCall } from './utils/handleCall'
import { DEFAULT_PORT_NAME } from './port_name'
import { toErrorMessage } from './utils'

export function createBackgroundHandler(
  router: RouterRecord,
  port_name: string = DEFAULT_PORT_NAME
) {
  Browser.runtime.onConnect.addListener((port) => {
    if (port.name !== port_name) {
      return
    }
    port.onMessage.addListener(async (rawMessage) => {
      // @types/webextension-polyfill >=0.11 types the listener message as `unknown`
      const { calls, args } = rawMessage as C2BMessage

      function throwError(error: unknown) {
        const error_message = toErrorMessage(error)
        port.postMessage({ error: error_message })
        throw error
      }
      try {
        // @ts-expect-error : calls is an array of strings, but router is an object with functions
        const func: Function = calls.reduce((acc, call) => acc[call], router)
        await handleCall(func, args, (message) => {
          port.postMessage(message)
        })
      } catch (error) {
        throwError(error)
      } finally {
        port.disconnect()
      }
    })
  })
}
