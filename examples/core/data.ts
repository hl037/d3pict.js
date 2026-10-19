import { D3PChart, d3pAutoInteractionArea, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createDataScenario } from '../scenarios/data'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createDataScenario(bus)
  const { objects, tooltip, actions } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const bar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  container.before(bar)
  // a button for each way to change the data
  for (const [name, run] of Object.entries(actions)) bar.append(Object.assign(document.createElement('button'), { textContent: name, onclick: run }))

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
    bar.remove()
    container.remove()
  }
}
