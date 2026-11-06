import { B2CMessage } from '../types'
import { RpcError } from '../RpcError'
import { toErrorMessage } from './util'

export async function handleCall(
  func: Function,
  args: any[],
  sendMessage: (message: B2CMessage) => void
): Promise<any> {
  if (typeof func !== 'function') {
    throw new TypeError(
      `RPC target is not callable: expected a function, received ${typeof func}`
    )
  }

  const gen = func(...args)

  // Promise / thenable. Checking for `.then` instead of `instanceof Promise`
  // also handles cross-realm promises and any other thenable.
  if (gen !== null && gen !== undefined && typeof gen.then === 'function') {
    const result = await gen
    sendMessage({ isStream: false, value: result })
    return // 返回后不再处理其他逻辑
  }

  //Generator
  if (typeof gen?.next === 'function') {
    if (typeof gen[Symbol.asyncIterator] === 'function') {
      let iterationResult = await gen.next()
      while (!iterationResult.done) {
        sendMessage({
          isStream: true,
          value: iterationResult.value,
          done: false,
        })
        iterationResult = await gen.next()
      }
      sendMessage({ isStream: true, value: null, done: true })
      return
    }

    if (typeof gen[Symbol.iterator] === 'function') {
      let iterationResult = gen.next()
      const value = []
      while (!iterationResult.done) {
        value.push(iterationResult.value)
        iterationResult = gen.next()
      }
      sendMessage({ isStream: false, value })
      return
    }
    const error = new RpcError('REMOTE_ERROR', 'Unsupported type of generator', {
      name: 'UnsupportedType',
    })
    sendMessage({ error: toErrorMessage(error) })
    throw error
  }

  //Other
  sendMessage({ isStream: false, value: gen })
}
