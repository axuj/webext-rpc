export interface RouterRecord {
  [key: string]: Function | RouterRecord
}

interface BaseMessage {
  error?: undefined
  value: any
}

interface StreamMessage extends BaseMessage {
  isStream: true
  done: boolean
}

interface NonStreamMessage extends BaseMessage {
  isStream: false
}

export interface ErrorSerializable {
  message: string
  stack?: string
  name: string
}

export interface ErrorMessage {
  error: ErrorSerializable
}

export type B2CMessage = ErrorMessage | StreamMessage | NonStreamMessage

export interface C2BMessage {
  calls: string[]
  args: any[]
}

export type RpcFunction<T> = T extends (...args: infer A) => infer R
  ? (
      ...args: A
    ) => R extends Promise<any>
      ? R
      : R extends Generator<infer U>
      ? Promise<U[]>
      : Promise<R>
  : Promise<T>

export type RpcRouter<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any
    ? RpcFunction<T[K]>
    : RpcRouter<T[K]>
}
