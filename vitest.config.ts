import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Configure test behavior however you like
  test: {
    mockReset: true,
    restoreMocks: true,
  },
  // If any dependencies rely on webextension-polyfill, add them here to the `ssr.noExternal` option.
  // Example:
  ssr: {
    noExternal: ['@webext-core/storage'],
  },
})
