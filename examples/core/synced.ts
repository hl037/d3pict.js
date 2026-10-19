import { D3PChart, d3pAutoInteractionArea, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createSyncedScenario } from '../scenarios/synced'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createSyncedScenario(bus)
  const { charts, tooltip } = scenario
  const row = Object.assign(document.createElement('div'), { className: 'chart-column' })
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
  // #endregion mount

  return () => {
    stopTooltip()
    stops.forEach((stop) => stop())
    scenario.destroy()
    row.remove()
  }
}
