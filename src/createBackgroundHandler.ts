import Browser from 'webextension-polyfill'
import { C2BMessage, RouterRecord } from './types'
import { toError } from './utils/util'
import { handleCall } from './utils/handleCall'
import { DEFAULT_PORT_NAME } from './port_name'

export function createBackgroundHandler(
  router: RouterRecord,
  port_name: string = DEFAULT_PORT_NAME
) {
  Browser.runtime.onConnect.addListener((port) => {
    if (port.name !== port_name) {
      return
    }
    port.onMessage.addListener(async (message: C2BMessage) => {
      const { calls, args } = message

      function throwError(error: Error) {
        port.postMessage({ error: error.message })
        throw error
      }
      try {
        // @ts-expect-error : calls is an array of strings, but router is an object with functions
        const func: Function = calls.reduce((acc, call) => acc[call], router)
        await handleCall(func, args, (message) => {
          port.postMessage(message)
        })
      } catch (error) {
        throwError(toError(error))
      } finally {
        port.disconnect()
      }
    })
  })
}
