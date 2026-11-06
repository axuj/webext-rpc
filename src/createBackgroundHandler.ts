import Browser from 'webextension-polyfill'
import { B2CMessage, C2BMessage, RouterRecord } from './types'
import { handleCall } from './utils/handleCall'
import { DEFAULT_PORT_NAME } from './port_name'
import { toErrorMessage, toRpcError } from './utils'
import { RpcError } from './RpcError'

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

// The error names are kept as `TypeError` so code that already matched on the
// name keeps working; what is new is the machine-readable `code`.
function invalidRequest(message: string): RpcError {
  return new RpcError('INVALID_REQUEST', message, { name: 'TypeError' })
}

function invalidPath(message: string): RpcError {
  return new RpcError('INVALID_PATH', message, { name: 'TypeError' })
}

function resolveRpcFunction(router: RouterRecord, calls: unknown): Function {
  if (
    !Array.isArray(calls) ||
    calls.some((call) => typeof call !== 'string')
  ) {
    throw invalidRequest(
      'Invalid RPC message: "calls" must be an array of strings'
    )
  }

  let current: any = router
  for (const segment of calls) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw invalidPath(`RPC path segment "${segment}" is not allowed`)
    }

    if (
      current === null ||
      (typeof current !== 'object' && typeof current !== 'function')
    ) {
      throw invalidPath(`Invalid RPC path: cannot read "${segment}"`)
    }

    if (!Object.hasOwn(current, segment)) {
      throw invalidPath(`Unknown RPC path segment "${segment}"`)
    }

    current = current[segment]
  }

  if (typeof current !== 'function') {
    throw invalidPath(
      `RPC path "${
        calls.length > 0 ? calls.join('.') : '<root>'
      }" does not resolve to a function`
    )
  }

  return current
}

export function createBackgroundHandler(
  router: RouterRecord,
  port_name: string = DEFAULT_PORT_NAME
) {
  Browser.runtime.onConnect.addListener((port) => {
    if (port.name !== port_name) {
      return
    }

    let connected = true
    port.onDisconnect.addListener(() => {
      connected = false
    })

    port.onMessage.addListener(async (rawMessage) => {
      let errorPosted = false

      const sendMessage = (message: B2CMessage) => {
        port.postMessage(message)
        if (message.error) {
          errorPosted = true
        }
      }

      try {
        if (typeof rawMessage !== 'object' || rawMessage === null) {
          throw invalidRequest('Invalid RPC message: expected an object')
        }

        const { calls, args } = rawMessage as C2BMessage
        if (!Array.isArray(args)) {
          throw invalidRequest('Invalid RPC message: "args" must be an array')
        }

        const func = resolveRpcFunction(router, calls)
        await handleCall(func, args, sendMessage)
      } catch (error) {
        // Never rethrow from the listener: that would turn into an unhandled
        // rejection. Post the error once (best effort) and let the client's
        // disconnect handling cover a failed postMessage.
        if (!errorPosted && connected) {
          try {
            port.postMessage({ error: toErrorMessage(toRpcError(error)) })
          } catch {
            // The port is gone or the error could not be serialized.
          }
        }
      } finally {
        connected = false
        try {
          port.disconnect()
        } catch {
          // The port is already disconnected.
        }
      }
    })
  })
}
