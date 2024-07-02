export class MessageStream<T> {
  private readableStream: ReadableStream<T>
  private controller?: ReadableStreamDefaultController<T>

  constructor() {
    this.readableStream = new ReadableStream<T>({
      start: (controller) => {
        this.controller = controller
      },
    })
  }

  // 添加消息到流
  addMessage(message: T) {
    if (this.controller) {
      this.controller.enqueue(message)
    }
  }

  // 关闭流
  close() {
    if (this.controller) {
      this.controller.close()
    }
  }

  // 返回一个异步生成器来获取数据
  async *getMessages(): AsyncGenerator<T, void, undefined> {
    const reader = this.readableStream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        yield value
      }
    } finally {
      reader.releaseLock()
    }
  }
}
