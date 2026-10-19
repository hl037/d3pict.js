import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// One app, three frameworks: each example mounts into its own root.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue(), react()],
  resolve: {
    // the examples import the library the way an application does
    alias: [
      { find: /^d3pict\/vue$/, replacement: new URL('../src/vue/index.ts', import.meta.url).pathname },
      { find: /^d3pict\/react$/, replacement: new URL('../src/react/index.ts', import.meta.url).pathname },
      { find: /^d3pict$/, replacement: new URL('../src/index.ts', import.meta.url).pathname },
      { find: '@', replacement: new URL('../src', import.meta.url).pathname },
    ],
  },
  build: { outDir: '../dist-examples', emptyOutDir: true },
})
