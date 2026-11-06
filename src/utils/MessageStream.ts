import { readerToAsyncGenerator } from './readerToAsyncGenerator'

type StreamState = 'open' | 'closed' | 'errored'

export class MessageStream<T> {
  private readableStream: ReadableStream<T>
  private controller?: ReadableStreamDefaultController<T>
  private state: StreamState = 'open'
  private failure?: { reason: unknown }

  constructor() {
    this.readableStream = new ReadableStream<T>({
      start: (controller) => {
        this.controller = controller
      },
    })
  }

  // 添加消息到流。流已关闭或出错后忽略，避免在 port 消息监听器里抛错。
  addMessage(message: T) {
    if (this.state !== 'open' || !this.controller) {
      return
    }
    this.controller.enqueue(message)
  }

  // 关闭流，幂等
  close() {
    if (this.state !== 'open' || !this.controller) {
      return
    }
    this.state = 'closed'
    this.controller.close()
  }

  // 让流进入错误状态，幂等。已排队的消息会一起丢弃，需要保留它们时用
  // endWithError。
  error(reason?: any) {
    if (this.state !== 'open' || !this.controller) {
      return
    }
    this.state = 'errored'
    this.controller.error(reason)
  }

  // 正常收尾，但让消费者在被已排队的消息喂完之后收到错误。用于"上游已经
  // 没数据了，但它不是正常结束"的情况（例如端口在流传输中途断开）：已收到
  // 的数据不丢，截断这件事也不会被当成正常完成。
  endWithError(reason: unknown) {
    if (this.state !== 'open' || !this.controller) {
      return
    }
    this.failure = { reason }
    try {
      this.close()
    } catch {
      // The consumer already cancelled the stream; nothing left to finish.
    }
  }

  // 返回一个异步生成器来获取数据
  async *getMessages(): AsyncGenerator<T, void, undefined> {
    const reader = this.readableStream.getReader()
    yield* readerToAsyncGenerator(reader)
    // Only reached when the consumer drained the stream itself; an early
    // `break` skips this, so stopping early is not reported as a failure.
    if (this.failure) {
      throw this.failure.reason
    }
  }
}
