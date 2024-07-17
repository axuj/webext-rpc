import { ErrorSerializable } from '../types'

export function toErrorMessage(error: unknown): ErrorSerializable {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }
  return {
    message: String(error),
    stack: '',
    name: 'UnknownError',
  }
}
