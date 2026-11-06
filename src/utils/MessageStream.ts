import { readerToAsyncGenerator } from './readerToAsyncGenerator'

type StreamState = 'open' | 'closed' | 'errored'

export class MessageStream<T> {
  private readableStream: ReadableStream<T>
  private controller?: ReadableStreamDefaultController<T>
  private state: StreamState = 'open'

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

  // 让流进入错误状态，幂等
  error(reason?: any) {
    if (this.state !== 'open' || !this.controller) {
      return
    }
    this.state = 'errored'
    this.controller.error(reason)
  }

  // 返回一个异步生成器来获取数据
  async *getMessages(): AsyncGenerator<T, void, undefined> {
    const reader = this.readableStream.getReader()
    yield* readerToAsyncGenerator(reader)
  }
}
