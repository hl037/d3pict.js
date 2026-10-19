import { defineConfig } from 'tsdown'
import Vue from 'unplugin-vue/rolldown'

export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/react/index.ts', vue: 'src/vue/index.ts' },
  format: 'esm',
  platform: 'neutral',
  dts: { vue: true },
  clean: true,
  plugins: [Vue({ isProduction: true })],
  external: ['react', 'react-dom', 'vue', 'd3', /^d3-/],
  alias: { '@': new URL('./src', import.meta.url).pathname },
})
