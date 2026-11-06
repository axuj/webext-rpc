export type RpcErrorCode =
  // The port went away before the call could finish. For a stream this means
  // the data was cut short rather than completed.
  | 'PORT_DISCONNECTED'
  // The remote function threw.
  | 'REMOTE_ERROR'
  // The path does not resolve to a callable function in the router.
  | 'INVALID_PATH'
  // The message itself is malformed (calls/args are not arrays, etc).
  | 'INVALID_REQUEST'

const RPC_ERROR_CODES: readonly string[] = [
  'PORT_DISCONNECTED',
  'REMOTE_ERROR',
  'INVALID_PATH',
  'INVALID_REQUEST',
]

export function isRpcErrorCode(value: unknown): value is RpcErrorCode {
  return typeof value === 'string' && RPC_ERROR_CODES.includes(value)
}

export interface RpcErrorOptions {
  // Only kept on the side that created the error: arbitrary values cannot
  // cross a port, so `cause` is deliberately not part of the wire format.
  cause?: unknown
  // Preserve the original error name (for example 'TypeError').
  name?: string
}

export class RpcError extends Error {
  readonly code: RpcErrorCode

  constructor(
    code: RpcErrorCode,
    message: string,
    options: RpcErrorOptions = {}
  ) {
    super(message)
    this.name = options.name ?? 'RpcError'
    this.code = code
    if (options.cause !== undefined) {
      this.cause = options.cause
    }
  }
}
