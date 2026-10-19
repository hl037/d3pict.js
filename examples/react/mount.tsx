import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { D3PRProvider } from '../../src/react'

/** Mount a React example in its own root (the provider gives it its own bus). */
export function reactMount(Component: ComponentType) {
  return (root: HTMLElement) => {
    const host = Object.assign(document.createElement('div'), { className: 'example-root' })
    root.append(host)
    const reactRoot = createRoot(host)
    reactRoot.render(
      <D3PRProvider>
        <Component />
      </D3PRProvider>,
    )
    return () => {
      reactRoot.unmount()
      host.remove()
    }
  }
}
