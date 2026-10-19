import { D3PChart, d3pAutoInteractionArea, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createShowcaseScenario } from '../scenarios/showcase'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createShowcaseScenario(bus)
  const { charts, tooltip, actions, sizes, setSize } = scenario
  const row = Object.assign(document.createElement('div'), { className: 'chart-column' })
  root.append(row)

  // #region mount
  const bar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  row.before(bar)
  // one button for each way to change the data of the charts
  for (const [name, run] of Object.entries(actions)) bar.append(Object.assign(document.createElement('button'), { textContent: name, onclick: run }))
  // the number of points of the last chart
  const select = Object.assign(document.createElement('select'), { title: 'points of the last chart', onchange: () => setSize(+select.value) })
  for (const n of sizes) select.append(Object.assign(document.createElement('option'), { value: String(n), textContent: `${n.toLocaleString('en')} points` }))
  bar.append(select)

  const stops = charts.map(({ objects, margin }) => {
    const container = row.appendChild(document.createElement('div'))
    container.style.cssText = 'flex: 1; min-width: 0; min-height: 360px' // the charts share the height
    const chart = new D3PChart({ container, bus, margin })
    const stopArea = d3pAutoInteractionArea(chart) // before the objects: the tools, cursor and tooltip ask for an interaction area
    objects.forEach((o) => o.addToChart(chart))
    return () => (stopArea(), chart.destroy())
  })
  const stopTooltip = d3pDomTooltip(tooltip)
  // #endregion mount

  return () => {
    stopTooltip()
    stops.forEach((stop) => stop())
    scenario.destroy()
    bar.remove()
    row.remove()
  }
}
