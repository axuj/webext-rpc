import { describe, it, expect, vi } from 'vitest'
import { createRpcCaller } from '../utils'

type Router = {
  a: {
    b: {
      c(id: number, msg: string): string
    }
  }
  d: {
    e(): Promise<string>
  }
  f(): Generator<string, void, unknown>
  g(count: number): AsyncGenerator<string, void, unknown>
}

describe('createRpcCaller', () => {
  it('should call a.b.c with correct arguments', async () => {
    const callback = vi.fn()

    const rpcCaller = createRpcCaller<Router>(callback)

    rpcCaller.a.b.c(1, 'hello')

    expect(callback).toHaveBeenCalledWith(['a', 'b', 'c'], [1, 'hello'])
  })

  it('should call d.e with correct arguments', async () => {
    const callback = vi.fn()

    const rpcCaller = createRpcCaller<Router>(callback)

    rpcCaller.d.e()

    expect(callback).toHaveBeenCalledWith(['d', 'e'], [])
  })

  it('should call f with correct arguments', async () => {
    const callback = vi.fn()

    const rpcCaller = createRpcCaller<Router>(callback)

    rpcCaller.f()

    expect(callback).toHaveBeenCalledWith(['f'], [])
  })

  it('should call g with correct arguments', async () => {
    const callback = vi.fn()

    const rpcCaller = createRpcCaller<Router>(callback)

    rpcCaller.g(10)

    expect(callback).toHaveBeenCalledWith(['g'], [10])
  })

  it('should call multiple methods correctly', async () => {
    const callback = vi.fn()

    const rpcCaller = createRpcCaller<Router>(callback)

    rpcCaller.a.b.c(1, 'hello')
    rpcCaller.d.e()
    rpcCaller.f()
    rpcCaller.g(10)

    expect(callback).toHaveBeenCalledWith(['a', 'b', 'c'], [1, 'hello'])
    expect(callback).toHaveBeenCalledWith(['d', 'e'], [])
    expect(callback).toHaveBeenCalledWith(['f'], [])
    expect(callback).toHaveBeenCalledWith(['g'], [10])
  })
})
