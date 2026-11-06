// A chunked streaming endpoint served by the WXT dev server, so the demo can
// exercise a real fetch + ReadableStream without an API key or network access.
// Query params: prompt (echoed back), delay (ms per chunk), fail=1 (drop the
// connection halfway through, useful for checking error propagation).
//
// Only one dev-server hook is used here, so its shape is declared locally
// rather than pulling in Vite's types (vite is not a direct dependency of the
// demo). The `any` on the handler args is confined to this file.
const STORY =
  'Once upon a time a small RPC call lived inside a browser extension. ' +
  'Every message it sent crossed the boundary between the page and the ' +
  'background, and came back with an answer. One day it met a real HTTP ' +
  'stream and learned to read the body one chunk at a time.'

type DevServerLike = {
  middlewares: {
    use: (path: string, handler: (req: any, res: any) => void) => void
  }
}

export function mockStream() {
  return {
    name: 'demo:mock-stream',
    configureServer(server: DevServerLike) {
      server.middlewares.use('/mock/stream', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const prompt = url.searchParams.get('prompt') ?? ''
        const delay = Number(url.searchParams.get('delay') ?? 100)
        const shouldFail = url.searchParams.get('fail') === '1'

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Access-Control-Allow-Origin', '*')

        const words = prompt
          ? [`You asked: "${prompt}".`, '', ...STORY.split(' ')]
          : STORY.split(' ')
        let index = 0

        const timer = setInterval(() => {
          if (shouldFail && index === 5) {
            clearInterval(timer)
            res.destroy()
            return
          }
          if (index >= words.length) {
            clearInterval(timer)
            res.end()
            return
          }
          res.write(`${words[index++]} `)
        }, delay)

        req.on('close', () => clearInterval(timer))
      })
    },
  }
}
