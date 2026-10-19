import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createLinesScenario } from '../scenarios/lines'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createLinesScenario(bus)
  const { objects, margin, tooltip, legend } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const chart = new D3PChart({ container, bus, margin })
  const stopArea = d3pAutoInteractionArea(chart) // before the objects: the tools, the cursor and the tooltip ask for an interaction area
  objects.forEach((o) => o.addToChart(chart))
  const stopTooltip = d3pDomTooltip(tooltip)
  const stopLegend = d3pDomLegend(legend)
  // #endregion mount

  return () => {
    stopTooltip()
    stopLegend()
    stopArea()
    chart.destroy()
    scenario.destroy()
    container.remove()
  }
}
