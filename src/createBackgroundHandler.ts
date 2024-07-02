import Browser from 'webextension-polyfill'
import { B2CMessage, C2BMessage, RouterRecord } from './types'
import { toError } from './utils/util'
import { handleCall } from './utils/handleCall'

export function createBackgroundHandler(router: RouterRecord) {
  Browser.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener(async (message: C2BMessage) => {
      const { calls, args } = message
      let result: B2CMessage = {
        isStream: false,
        value: null,
        error: null,
        done: false,
      }
      function throwError(error: Error) {
        result.error = error.message
        port.postMessage(result)
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
