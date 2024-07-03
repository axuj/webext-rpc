import { B2CMessage } from '../types'

export async function handleCall(
  func: Function,
  args: any[],
  sendMessage: (message: B2CMessage) => void
): Promise<any> {
  const gen = func(...args)
  if (gen instanceof Promise) {
    const result = await gen
    sendMessage({ isStream: false, value: result, done: false, error: null })
    return // 返回后不再处理其他逻辑
  }

  if (typeof gen?.next === 'function') {
    if (typeof gen[Symbol.asyncIterator] === 'function') {
      let iterationResult = await gen.next()
      while (!iterationResult.done) {
        sendMessage({
          isStream: true,
          value: iterationResult.value,
          done: false,
          error: null,
        })
        iterationResult = await gen.next()
      }
      sendMessage({ isStream: true, value: null, done: true, error: null })
      return
    }

    if (typeof gen[Symbol.iterator] === 'function') {
      let iterationResult = gen.next()
      const value = []
      while (!iterationResult.done) {
        value.push(iterationResult.value)
        iterationResult = gen.next()
      }
      sendMessage({ isStream: false, value, done: false, error: null })
      return
    }
    throw new Error('Unsupported generator type')
  }

  sendMessage({ isStream: false, value: gen, done: false, error: null })
}
