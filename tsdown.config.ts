import { defineConfig } from 'tsdown'

const entry = {
  index: 'src/index.ts',
  'utils/index': 'src/utils/index.ts',
}

export default defineConfig([
  {
    entry,
    outDir: 'lib',
    clean: true,
    // tsconfig enables declarationMap for editor use; the package ships no maps.
    dts: { sourcemap: false },
    sourcemap: false,
    // ESM uses .js, CJS uses .cjs in a `type: module` package.
    fixedExtension: false,
    format: ['esm', 'cjs'],
    // Keep the polyfill external: ESM/CJS leave it as an import/require.
    deps: {
      neverBundle: ['webextension-polyfill'],
    },
  },
  // IIFE does not support code splitting, and disabling it requires a single
  // entry — each global build therefore needs its own config.
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    clean: false,
    dts: false,
    fixedExtension: false,
    format: 'iife',
    globalName: 'webextRPC',
    // The IIFE is the browser drop-in, so the polyfill must be inlined.
    deps: {
      alwaysBundle: ['webextension-polyfill'],
      onlyBundle: false,
    },
    outputOptions: {
      entryFileNames: '[name].global.js',
      codeSplitting: false,
    },
  },
  {
    entry: { 'utils/index': 'src/utils/index.ts' },
    outDir: 'lib',
    clean: false,
    dts: false,
    fixedExtension: false,
    format: 'iife',
    globalName: 'webextRPC',
    outputOptions: {
      entryFileNames: '[name].global.js',
      codeSplitting: false,
    },
  },
])
