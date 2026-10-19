import type { D3PToolbox } from '../../src'
import { toolButtons } from '../scenarios/tools'
import { t } from '../shared/i18n'

type Off = () => void

/** Toggle buttons for the toolbox tools (+ a reset button). */
export function toolbar(toolbox: D3PToolbox, resetView: () => void): { node: HTMLElement; dispose: Off } {
  const buttons = toolButtons().map(({ name, label }) => {
    const b = Object.assign(document.createElement('button'), { textContent: label, onclick: () => toolbox.setToolActive(name, !toolbox.isToolActive(name)) })
    return { name, b }
  })
  const refresh = () => buttons.forEach(({ name, b }) => b.classList.toggle('on', toolbox.isToolActive(name)))
  refresh()
  const off = toolbox.bus.on(toolbox.e.toolStateChanged, refresh)
  const node = Object.assign(document.createElement('div'), { className: 'toolbar' })
  node.append(...buttons.map((x) => x.b), Object.assign(document.createElement('button'), { textContent: t('reset'), onclick: resetView }))
  return { node, dispose: off }
}
