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
  async *fetchStream(api_key: string, prompt: string) {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent'
    const response = await fetch(`${url}?key=${api_key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get reader from response body')
    }
    yield* readerToAsyncGenerator(reader, (value) => {
      const text = new TextDecoder().decode(value)
      return text
    })
  },
}

// only type
export type AppRouter = typeof router
