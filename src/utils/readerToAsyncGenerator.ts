export async function* readerToAsyncGenerator<T, R = T>(
  reader: ReadableStreamDefaultReader<T>,
  pipe?: (value: T) => R | Promise<R>
): AsyncGenerator<R> {
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    if (pipe !== undefined) {
      yield pipe(value)
    } else {
      yield value as unknown as R
    }
  }
}
