import { defineConfig } from 'wxt'
import { mockStream } from './mock-stream'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    host_permissions: ['*://*/*'],
  },
  modules: ['@wxt-dev/module-vue'],
  dev: {
    server: {
      port: 3526,
    },
  },
  // Serves /mock/stream from the same dev server, so the streaming demo does
  // not depend on an external API.
  vite: () => ({
    plugins: [mockStream()],
  }),
})
