import { describe, it, expect, vi } from 'vitest'
import { readerToAsyncGenerator } from '../utils/readerToAsyncGenerator'

describe('readerToAsyncGenerator', () => {
  it('should yield values from the reader', async () => {
    const reader = {
      async read() {
        return { done: false, value: 'test' }
      },
    }

    const generator = readerToAsyncGenerator(reader as any)

    let result = (await generator.next()).value
    expect(result).toBe('test')

    // @ts-expect-error
    reader.read = async () => ({ done: true, value: null })
    result = (await generator.next()).done
    expect(result).toBe(true)
  })

  it('should apply pipe function to values', async () => {
    const reader = {
      async read() {
        return { done: false, value: 2 }
      },
    }

    const pipe = vi.fn((n: number) => String(n * 2))
    const generator = readerToAsyncGenerator(reader as any, pipe)

    let result = (await generator.next()).value
    expect(result).toBe('4')
    expect(pipe).toHaveBeenCalledWith(2)

    // @ts-expect-error
    reader.read = async () => ({ done: true, value: null })
    result = (await generator.next()).done
    expect(result).toBe(true)
  })

  it('should apply async pipe function to values', async () => {
    const reader = {
      async read() {
        return { done: false, value: 2 }
      },
    }

    const pipe = vi.fn(async (n: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return String(n * 2)
    })
    const generator = readerToAsyncGenerator(reader as any, pipe)

    let result = (await generator.next()).value
    expect(result).toBe('4')
    expect(pipe).toHaveBeenCalledWith(2)

    // @ts-expect-error
    reader.read = async () => ({ done: true, value: null })
    result = (await generator.next()).done
    expect(result).toBe(true)
  })

  it('should stop yielding when reader is done', async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: 'value1' })
        .mockResolvedValueOnce({ done: true, value: null }),
    }

    const generator = readerToAsyncGenerator(reader as any)

    let result1 = (await generator.next()).value
    expect(result1).toBe('value1')

    let result2 = (await generator.next()).done
    expect(result2).toBe(true)

    expect(reader.read).toHaveBeenCalledTimes(2)
  })
})
