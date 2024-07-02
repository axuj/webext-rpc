export interface RouterRecord {
  [key: string]: Function | RouterRecord
}

export interface B2CMessage {
  isStream: boolean
  value: any
  done: boolean
  error: string | null
}

export interface C2BMessage {
  calls: string[]
  args: any[]
}

export type Promisify<T> = T extends (...args: infer A) => infer R
  ? (
      ...args: A
    ) => R extends Promise<any>
      ? R
      : R extends Generator<infer U>
      ? Promise<U[]>
      : Promise<R>
  : Promise<T>

export type PromisifiedRouter<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any
    ? Promisify<T[K]>
    : PromisifiedRouter<T[K]>
}

// type Router = {
//   f(): Generator<string, void, unknown>
// }

// type a = PromisifiedRouter<Router>
