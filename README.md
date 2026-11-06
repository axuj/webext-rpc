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
  async *fetchStream(prompt: string) {
    const response = await fetch(`...`)
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }
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
import { client } from '@/webext-rpc/client'
const a = await client.normalFunction(1, 'hello')
const b = await client.asyncFunction()
const c = await client.generatorFunction()
const iter = await client.asyncGeneratorFunction(3)
const d = []
for await (const i of iter) {
  d.push(i)
}
let e = ''
const fetch_iter = await client.fetchStream('prompt')
for await (const i of fetch_iter) {
  e += i
}
```

Check out the [demo](https://github.com/axuj/webext-rpc/tree/main/demo)

## Error handling

A failed call rejects with an `RpcError` carrying a `code` you can branch on:

```typescript
import { RpcError } from 'webext-rpc'

try {
  await client.normalFunction(1, 'hello')
} catch (error) {
  if (error instanceof RpcError) {
    switch (error.code) {
      // The port went away before the call finished.
      case 'PORT_DISCONNECTED':
      // The background function threw.
      case 'REMOTE_ERROR':
      // The path does not resolve to a function in the router.
      case 'INVALID_PATH':
      // The message was malformed.
      case 'INVALID_REQUEST':
    }
  }
}
```

Streams behave the same way. A stream that is cut short (the port disappears, the background is killed, the extension reloads) throws after delivering the values already received, so a truncated stream never looks like a completed one:

```typescript
let text = ''
try {
  for await (const chunk of await client.fetchStream('prompt')) {
    text += chunk
  }
} catch (error) {
  // `text` still holds everything that arrived before the disconnect.
}
```

`cause` is only available where the error was created; it does not cross the port.

## Generate utils

### readerToAsyncGenerator

This function converts a `ReadableStreamDefaultReader` to an `AsyncGenerator`.

```typescript
import { readerToAsyncGenerator } from 'webext-rpc/utils'
const response = await fetch(`...`)
const reader = response.body?.getReader()
yield *
  readerToAsyncGenerator(reader, (value) => {
    const text = new TextDecoder().decode(value)
    return text
  })
```

### MessageStream

MessageStream allows for handling message streams.
It provides a mechanism to add messages and signal the end of the stream.
Consumers can then utilize an AsyncGenerator to process the stream

```typescript
import { ExposedPromise } from 'webext-rpc/utils'

async function testForCallback(callback: (message: string) => Promise<void>) {
  for (let i = 0; i < 3; i++) {
    callback(`message ${i}`)
  }
}

const stream = new MessageStream<string>()
testForCallback(async (message) => {
  stream.addMessage(message)
})
stream.close()

const messageGenerator: AsyncGenerator<string> = stream.getMessages()

expect((await messageGenerator.next()).value).toBe('message 0')
expect((await messageGenerator.next()).value).toBe('message 1')
expect((await messageGenerator.next()).value).toBe('message 2')
expect((await messageGenerator.next()).done).toBe(true)
```

## Inspiration

This library was inspired by two excellent libraries:

[tRPC](https://github.com/trpc/trpc)

[@webext-core/proxy-service](https://github.com/aklinker1/webext-core/tree/main/packages/proxy-service)
