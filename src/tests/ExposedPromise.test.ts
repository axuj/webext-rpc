import { describe, it, expect } from 'vitest'
import { ExposedPromise } from '../utils'

describe('ExposedPromise', () => {
  it('should resolve correctly', async () => {
    const exposedPromise = new ExposedPromise<string>()
    exposedPromise.resolve('success')

    const result = await exposedPromise.promise
    expect(result).toBe('success')
  })

  it('should reject correctly', async () => {
    const exposedPromise = new ExposedPromise<string>()
    exposedPromise.reject('error')

    try {
      await exposedPromise.promise
    } catch (e) {
      expect(e).toBe('error')
    }
  })

  it('should work with async/await', async () => {
    const exposedPromise = new ExposedPromise<number>()

    setTimeout(() => exposedPromise.resolve(42), 10)

    const result = await exposedPromise.promise
    expect(result).toBe(42)
  })
})
