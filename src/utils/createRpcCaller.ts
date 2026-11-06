import { RpcRouter, RouterRecord } from '../types'

// Reserved property names that must never be turned into RPC calls.
// `then` keeps the proxy from being mistaken for a thenable (`await client`,
// `Promise.resolve(client)`); `toJSON` does the same for `JSON.stringify`.
// Symbol properties (e.g. `Symbol.toStringTag`, inspection hooks) are ignored too.
// Real router members named `then` or `toJSON` are not addressable through the proxy.
const RESERVED_KEYS = new Set<string>(['then', 'toJSON'])

export function createRpcCaller<T extends RouterRecord>(
  callbacks: (calls: string[], args: any[]) => Promise<any>
): RpcRouter<T> {
  const createProxyObject = (calls: string[] = []): any => {
    const handler: ProxyHandler<any> = {
      get(_thisArg, prop, receiver) {
        if (typeof prop === 'symbol' || RESERVED_KEYS.has(prop)) {
          return undefined
        }
        return createProxyObject([...calls, prop])
      },
      async apply(_target, _thisArg, args) {
        return callbacks(calls, args)
      },
    }
    return new Proxy(() => {}, handler)
  }

  return createProxyObject() as RpcRouter<T>
}
