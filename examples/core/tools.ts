import { D3PChart, d3pAutoInteractionArea, getGlobalBus } from 'd3pict'
import { createToolsScenario } from '../scenarios/tools'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createToolsScenario(bus)
  const { objects, toolbox, reset } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const bar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  container.before(bar)
  const chart = new D3PChart({ container, bus })
  const stopArea = d3pAutoInteractionArea(chart) // the tools ask for an interaction area: answer before adding them
  objects.forEach((o) => o.addToChart(chart))

  // a button per tool, lit while the tool is active
  const buttons = ['pan', 'zoom-selection', 'zoom-click', 'wheel-zoom', 'wheel-pan'].map((name) => {
    const button = Object.assign(document.createElement('button'), { textContent: name, onclick: () => toolbox.setToolActive(name, !toolbox.isToolActive(name)) })
    return { name, button }
  })
  const refresh = () => buttons.forEach(({ name, button }) => button.classList.toggle('on', toolbox.isToolActive(name)))
  const stopTools = bus.on(toolbox.e.toolStateChanged, refresh)
  bar.append(...buttons.map(({ button }) => button), Object.assign(document.createElement('button'), { textContent: 'reset', onclick: () => reset.reset() }))
  refresh()
  // #endregion mount

  return () => {
    stopTools()
    stopArea()
    chart.destroy()
    scenario.destroy()
    bar.remove()
    container.remove()
  }
}
