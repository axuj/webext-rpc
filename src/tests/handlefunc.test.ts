import { describe, it, expect, vi } from 'vitest'
import { handleCall } from '../utils/handleCall'

describe('handleResult', () => {
  it('should handle Promise results', async () => {
    const mockSendMessage = vi.fn()
    const mockFunc = () => Promise.resolve('test')

    await handleCall(mockFunc, [], mockSendMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: 'test',
      done: false,
      error: null,
    })
  })

  it('should handle async generators', async () => {
    const mockSendMessage = vi.fn()
    async function* mockAsyncGenerator() {
      yield 'step1'
      yield 'step2'
    }

    await handleCall(mockAsyncGenerator, [], mockSendMessage)

    expect(mockSendMessage.mock.calls.length).toBe(3)
    expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
      isStream: true,
      value: 'step1',
      done: false,
      error: null,
    })
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
      isStream: true,
      value: 'step2',
      done: false,
      error: null,
    })
    expect(mockSendMessage).toHaveBeenNthCalledWith(3, {
      isStream: true,
      value: null,
      done: true,
      error: null,
    })
  })

  it('should handle sync generators', async () => {
    const mockSendMessage = vi.fn()
    function* mockSyncGenerator() {
      yield 'step1'
      yield 'step2'
    }

    await handleCall(mockSyncGenerator, [], mockSendMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: ['step1', 'step2'],
      done: false,
      error: null,
    })
  })

  it('should handle non-generator results', async () => {
    const mockSendMessage = vi.fn()
    const mockFunc = () => 'test'

    await handleCall(mockFunc, [], mockSendMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: 'test',
      done: false,
      error: null,
    })
  })

  it('void function', async () => {
    const mockSendMessage = vi.fn()
    const mockFunc = () => undefined

    await handleCall(mockFunc, [], mockSendMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: undefined,
      done: false,
      error: null,
    })
  })

  it('null function', async () => {
    const mockSendMessage = vi.fn()
    const mockFunc = () => null
    await handleCall(mockFunc, [], mockSendMessage)

    expect(mockSendMessage).toHaveBeenCalledWith({
      isStream: false,
      value: null,
      done: false,
      error: null,
    })
  })
})
