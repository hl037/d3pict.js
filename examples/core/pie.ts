import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createPieScenario } from '../scenarios/pie'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createPieScenario(bus)
  const { objects, system, tooltip, legend } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const chart = new D3PChart({ container, bus })
  const stopArea = d3pAutoInteractionArea(chart) // before the objects: the tools, the cursor and the tooltip ask for an interaction area
  objects.forEach((o) => o.addToChart(chart))
  const stopTooltip = d3pDomTooltip(tooltip)
  const stopLegend = d3pDomLegend(legend)

  // a pie is a donut with no hole
  const shape = Object.assign(document.createElement('div'), { className: 'toolbar' })
  for (const [name, innerRadius] of [['pie', 0], ['donut', 0.55]] as const) {
    const button = Object.assign(document.createElement('button'), { textContent: name, onclick: () => system.props({ innerRadius }) })
    shape.append(button)
  }
  container.before(shape)
  // #endregion mount

  return () => {
    stopTooltip()
    stopLegend()
    shape.remove()
    stopArea()
    chart.destroy()
    scenario.destroy()
    container.remove()
  }
}
