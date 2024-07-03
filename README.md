# webext-rpc

A type-safe RPC for all webextension, client side code does not contain the actual called code, supports async generator functions

This is a library for making RPC calls to a web extension from a web page. It uses the `webextension-polyfill` API to communicate with the extension, supports all browsers (Chrome, Firefox, Safari).

Supports `normal functions`, `async functions`, `generator functions`, and `async generator functions`.

## Usage

To use this library, you need to install webext-rpc in your project. You can install it using npm with the following command:

```typescript
pnpm install webext-rpc
```

1. Create a router

```typescript
// webext-rpc/router/index.ts
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
    const response = await fetch(`...`)
    const reader = response.body?.getReader()
    yield* readerToAsyncGenerator(reader, (value) => {
      const text = new TextDecoder().decode(value)
      return text
    })
  },
}

// only type
export type AppRouter = typeof router
```

2. Register the router in background

```typescript
// entrypoints/background.ts
import { router } from '@/webext-rpc/router'
import { createBackgroundHandler } from 'webext-rpc'

createBackgroundHandler(router)
```

3. Create a client and use it in the UI

```typescript
// webext-rpc/client.ts
import { createWebextRpcCaller } from 'webext-rpc'
import type { AppRouter } from './router'

// only use type
export const client = createWebextRpcCaller<AppRouter>()
```

```typescript
// entrypoints/content/app.ts
import { client } from '@/webext-rpc/erpc'
const a = await client.normalFunction(1, 'hello')
const b = await client.asyncFunction()
const c = await client.generatorFunction()
const iter = await client.asyncGeneratorFunction(3)
const d = []
for await (const i of iter) {
  d.push(i)
}
let e = ''
e += await client.fetchStream('api_key', 'prompt')
```

## Inspiration

This library was inspired by two excellent libraries:

[tRPC](https://github.com/trpc/trpc)

[@webext-core/proxy-service](https://github.com/aklinker1/webext-core/tree/main/packages/proxy-service)
