import { PromisifiedRouter, RouterRecord } from '../types'

export function createRpcCaller<T extends RouterRecord>(
  callbacks: (calls: string[], args: any[]) => Promise<any>
): PromisifiedRouter<T> {
  const createProxyObject = (calls: string[] = []): any => {
    const handler: ProxyHandler<any> = {
      get(_thisArg, prop, receiver) {
        return createProxyObject([...calls, prop.toString()])
      },
      async apply(_target, _thisArg, args) {
        return callbacks(calls, args)
      },
    }
    return new Proxy(() => {}, handler)
  }

  return createProxyObject() as PromisifiedRouter<T>
}
