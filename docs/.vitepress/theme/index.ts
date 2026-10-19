import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ExampleLive from './ExampleLive.vue'
import '../../../examples/example.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ExampleLive', ExampleLive)
  },
} satisfies Theme
