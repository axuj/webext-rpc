import { createWebextRpcCaller } from 'webext-rpc'
import type { AppRouter } from './router'

// only use type
export const erpc = createWebextRpcCaller<AppRouter>()
