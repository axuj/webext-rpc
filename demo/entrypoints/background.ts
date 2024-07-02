import { router } from '@/webext-rpc/router'
import { createBackgroundHandler } from 'webext-rpc'

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id })
  createBackgroundHandler(router)
})
