import { RpcError, type RpcErrorCode } from '../RpcError'
import type { ErrorSerializable } from '../types'

// `String(value)` turns `{ code: 1 }` into "[object Object]", which is useless
// once it reaches the caller. Prefer JSON when it works.
function describeNonError(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  try {
    const json = JSON.stringify(error)
    if (typeof json === 'string') {
      return json
    }
  } catch {
    // Circular structure or a throwing toJSON: fall back to String().
  }
  return String(error)
}

export function toErrorMessage(error: unknown): ErrorSerializable {
  if (error instanceof RpcError) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    }
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }
  return {
    message: describeNonError(error),
    stack: '',
    name: 'UnknownError',
  }
}

// Normalises anything thrown in the background into an RpcError so the code
// survives the trip back to the caller.
export function toRpcError(
  error: unknown,
  code: RpcErrorCode = 'REMOTE_ERROR'
): RpcError {
  if (error instanceof RpcError) {
    return error
  }
  const options =
    error instanceof Error
      ? { cause: error, name: error.name }
      : { cause: error, name: 'UnknownError' }
  return new RpcError(
    code,
    error instanceof Error ? error.message : describeNonError(error),
    options
  )
}
