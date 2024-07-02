import { AsyncFunctionRouter } from './AsyncFunctionRouter'

export const router = {
  a: {
    b: {
      normalFunction(id: number, msg: string) {
        return `this is normalFunction, id:${id}, msg:${msg}`
      },
    },
  },
  af: AsyncFunctionRouter,
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

// only type
export type AppRouter = typeof router
