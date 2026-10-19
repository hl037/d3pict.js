import { D3PChart, d3pAutoInteractionArea, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createTitlesScenario } from '../scenarios/titles'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createTitlesScenario(bus)
  const { objects, tooltip } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const chart = new D3PChart({ container, bus })
  const stopArea = d3pAutoInteractionArea(chart) // before the objects: the cursor and the tooltip ask for an interaction area
  objects.forEach((o) => o.addToChart(chart))
  const stopTooltip = d3pDomTooltip(tooltip)
  // #endregion mount

  return () => {
    stopTooltip()
    stopArea()
    chart.destroy()
    scenario.destroy()
    container.remove()
  }
}
