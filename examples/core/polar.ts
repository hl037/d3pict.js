import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, d3pMergeArray, getGlobalBus } from 'd3pict'
import { createPolarScenario } from '../scenarios/polar'

/** Core only. Switching geometry swaps the axes; the renderers, tools and tooltip stay attached. */
export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createPolarScenario(bus)
  const { axes, shared, tooltip, legend } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const bar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  container.before(bar)
  const chart = new D3PChart({ container, bus })
  const stopArea = d3pAutoInteractionArea(chart)
  const stopTooltip = d3pDomTooltip(tooltip)
  const stopLegend = d3pDomLegend(legend)

  // the axes are the only thing that depends on the geometry: swap them, keep the rest attached
  let attached: { addToChart(c: D3PChart): void; removeFromChart(c: D3PChart): void }[] = []
  const show = (geometry: 'cartesian' | 'polar') => {
    attached = d3pMergeArray(attached, [...axes[geometry], ...shared])
      .exit((o) => o.removeFromChart(chart))
      .enter((o) => o.addToChart(chart))
      .value()
  }
  for (const geometry of ['cartesian', 'polar'] as const) {
    bar.append(Object.assign(document.createElement('button'), { textContent: geometry, onclick: () => show(geometry) }))
  }
  show('polar')
  // #endregion mount

  return () => {
    stopTooltip()
    stopLegend()
    stopArea()
    chart.destroy()
    scenario.destroy()
    bar.remove()
    container.remove()
  }
}
