import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  // the examples import the library the way an application does
  resolve: {
    alias: [
      { find: /^d3pict\/vue$/, replacement: new URL('./src/vue/index.ts', import.meta.url).pathname },
      { find: /^d3pict\/react$/, replacement: new URL('./src/react/index.ts', import.meta.url).pathname },
      { find: /^d3pict$/, replacement: new URL('./src/index.ts', import.meta.url).pathname },
      { find: '@', replacement: new URL('./src', import.meta.url).pathname },
    ],
  },
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'] },
})
