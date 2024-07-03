import { createWebextRpcCaller } from 'webext-rpc'
import type { AppRouter } from './router'

// only use type
export const client = createWebextRpcCaller<AppRouter>()
