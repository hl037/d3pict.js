import { createApp, type Component } from 'vue'
import { D3PVPlugin } from '../../src/vue'

/** Mount a Vue example in its own app (the plugin gives it its own bus). */
export function vueMount(component: Component) {
  return (root: HTMLElement) => {
    const app = createApp(component)
    app.use(D3PVPlugin)
    const host = Object.assign(document.createElement('div'), { className: 'example-root' })
    root.append(host)
    app.mount(host)
    return () => {
      app.unmount()
      host.remove()
    }
  }
}
