import { defineConfig } from 'wxt'

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
})
