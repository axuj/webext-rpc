import { expect, it, describe, vi } from 'vitest'
import { ExposedPromise, MessageStream } from '../utils'

describe('MessageStream', () => {
  it('should handle closing the stream correctly', async () => {
    const stream = new MessageStream<string>()

    // 添加消息并关闭流
    stream.addMessage('message1')
    stream.addMessage('message2')
    stream.close()

    // 使用异步生成器来读取消息
    const receivedMessages: string[] = []
    for await (const message of stream.getMessages()) {
      receivedMessages.push(message)
    }

    // 确认流被关闭时能够正确读取结束
    expect(receivedMessages).toEqual(['message1', 'message2'])
  })

  it('should allow reading of messages after closing the stream', async () => {
    const stream = new MessageStream<number>()

    // 添加消息
    stream.addMessage(1)
    stream.addMessage(2)
    stream.addMessage(3)

    // 关闭流
    stream.close()

    // 消息数组用来储存读取到的消息
    const messages: number[] = []

    // 获取异步生成器
    const messageGenerator = stream.getMessages()

    // 从异步生成器中读取消息
    for await (const message of messageGenerator) {
      messages.push(message)
    }

    // 期望消息数组包含所有添加的消息
    expect(messages).toEqual([1, 2, 3])
  })

  it('getMessages should return messages from an ExposedPromise-resolved stream', async () => {
    const exposedPromise = new ExposedPromise<AsyncGenerator<string>>()
    const stream = new MessageStream<string>()

    // 在另一个异步线程发送消息和关闭
    setTimeout(() => {
      stream.addMessage('message 3')
      stream.close()
    }, 50)

    setTimeout(() => {
      stream.addMessage('message 1')
      stream.addMessage('message 2')

      exposedPromise.resolve(stream.getMessages())
    }, 30)

    const iter = await exposedPromise.promise

    const messages = []
    for await (const msg of iter) {
      messages.push(msg)
    }

    expect(messages).toEqual(['message 1', 'message 2', 'message 3'])
  })
})
