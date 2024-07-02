# webext-rpc

This is a library for making RPC calls to a web extension from a web page. It uses the `webextension-polyfill` API to communicate with the extension.

Supports normal functions, async functions, generator functions, and async generator functions.

## Usage

To use this library, you need to have a web extension installed in your browser. You can use the `webext-rpc` library by adding the following script tag to your web page

```typescript
pnpm install webext-rpc
```

1. Create a router

```typescript
// webext-rpc/router/index.ts
export const router = {
  normalFunction(id: number, msg: string) {
    return `this is normalFunction, id:${id}, msg:${msg}`
  },
  async asyncFunction() {
    return 'this is asyncFunction'
  },
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
// webext-rpc/erpc/index.ts
import { createWebextRpcCaller } from 'webext-rpc'
import type { AppRouter } from './router'

// only use type
export const erpc = createWebextRpcCaller<AppRouter>()
```

```typescript
// entrypoints/content/app.ts
import { erpc } from '@/webext-rpc/erpc'
const a = await normalFunction(1, 'hello')
const b = await asyncFunction()
const c = await generatorFunction()
const iter = await asyncGeneratorFunction(3)
const d = []
for await (const i of iter) {
  d.push(i)
}
```

## Inspiration

This library was inspired by two excellent libraries:

[tRPC](https://github.com/trpc/trpc)

[@webext-core/proxy-service](https://github.com/aklinker1/webext-core/tree/main/packages/proxy-service)
