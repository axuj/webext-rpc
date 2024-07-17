import { B2CMessage } from '../types'

export async function handleCall(
  func: Function,
  args: any[],
  sendMessage: (message: B2CMessage) => void
): Promise<any> {
  const gen = func(...args)

  // Promise
  if (gen instanceof Promise) {
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
    const error = {
      message: 'Unsupported type of generator',
      stack: new Error().stack,
      name: 'UnsupportedType',
    }
    sendMessage({ error })
    throw error
  }

  //Other
  sendMessage({ isStream: false, value: gen })
}
