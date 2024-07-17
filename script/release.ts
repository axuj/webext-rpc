import { $, cd } from 'zx'

async function release() {
  await $`pnpm run build`
  await $`npm publish`
}

release()
