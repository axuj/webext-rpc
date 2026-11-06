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
  async *fetchStream(prompt: string, options: { fail?: boolean } = {}) {
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

    // With `fail`, the stream dies a few chunks in. Throwing here is
    // deliberate: dropping the TCP connection instead would be swallowed by
    // fetch (a truncated chunked body looks like a clean end), and what this
    // button is meant to show is the error path that the library actually
    // owns — an exception in the background crossing the port after some
    // chunks already arrived.
    let delivered = 0
    for await (const chunk of readerToAsyncGenerator(
      reader,
      (value) => new TextDecoder().decode(value)
    )) {
      yield chunk
      delivered += 1
      if (options.fail && delivered === 3) {
        throw new Error('the upstream stream died after 3 chunks')
      }
    }
  },
}

// only type
export type AppRouter = typeof router
