import { readerToAsyncGenerator } from 'webext-rpc/utils'

const generateGroup = {
  *generatorFunction() {
    yield 'this is generatorFunction 1'
    yield 'this is generatorFunction 2'
  },
  async *asyncGeneratorFunction(count: number) {
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => setTimeout(() => resolve(void 0), 1000))
      yield `this is asyncGeneratorFunction, count:${i} ,time:${Date.now()}`
    }
  },
}
export const router = {
  normalFunction(id: number, msg: string) {
    return `this is normalFunction, id:${id}, msg:${msg}`
  },
  async asyncFunction() {
    return 'this is asyncFunction'
  },
  generateGroup,
  // Streams from a local chunked endpoint served by the WXT dev server, so the
  // demo needs no API key or network access. The fetch / status check / reader
  // path is the same one a real streaming API would use.
  async *fetchStream(prompt: string) {
    const url = new URL('http://localhost:3526/mock/stream')
    url.searchParams.set('prompt', prompt)
    url.searchParams.set('delay', '100')

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Stream request failed with status ${response.status}`)
    }
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get reader from response body')
    }
    yield* readerToAsyncGenerator(reader, (value) => new TextDecoder().decode(value))
  },
}

// only type
export type AppRouter = typeof router
