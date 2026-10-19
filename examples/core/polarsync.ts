import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createPolarSyncScenario } from '../scenarios/polarsync'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createPolarSyncScenario(bus)
  const { charts, tooltip, legend } = scenario
  const row = Object.assign(document.createElement('div'), { className: 'chart-row' })
  root.append(row)

  // #region mount
  const stops = charts.map(({ objects, margin }) => {
    const container = row.appendChild(document.createElement('div'))
    container.style.cssText = 'flex: 1; min-width: 0; min-height: 0' // the charts share the space
    const chart = new D3PChart({ container, bus, margin })
    const stopArea = d3pAutoInteractionArea(chart) // before the objects: the tools ask for an interaction area
    objects.forEach((o) => o.addToChart(chart))
    return () => (stopArea(), chart.destroy())
  })
  const stopTooltip = d3pDomTooltip(tooltip)
  const stopLegend = d3pDomLegend(legend)
  // #endregion mount

  return () => {
    stopTooltip()
    stopLegend()
    stops.forEach((stop) => stop())
    scenario.destroy()
    row.remove()
  }
}
