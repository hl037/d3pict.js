import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, getGlobalBus, type D3PBus, type D3PChartObject, type D3PLegendBundle, type D3PMargin, type D3PTooltip } from 'd3pict'

/** What a scenario hands over to be shown: the objects of a chart, and the HTML parts. */
export interface SingleScene {
  objects: D3PChartObject[]
  margin?: Partial<D3PMargin>
  tooltip?: D3PTooltip
  legend?: D3PLegendBundle
  /** Ways to change the data: a button each. */
  actions?: Record<string, () => void>
  /** The name of the files the chart is saved as (a button for the SVG, one for the PNG). */
  fileName?: string
  destroy(): void
}

/** Core only: the chart of a scenario that builds a single chart. */
export function mountScene(build: (bus: D3PBus) => SingleScene) {
  return (root: HTMLElement) => {
    const bus = getGlobalBus()
    const scene = build(bus)
    const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
    const toolbar = Object.assign(document.createElement('div'), { className: 'toolbar' })
    for (const [name, run] of Object.entries(scene.actions ?? {})) toolbar.append(Object.assign(document.createElement('button'), { textContent: name, onclick: run }))
    root.append(toolbar, container)
    const chart = new D3PChart({ container, bus, margin: scene.margin })
    if (scene.fileName) {
      for (const [label, run] of [['save SVG', () => chart.downloadSVG(`${scene.fileName}.svg`)], ['save PNG', () => chart.downloadPNG(`${scene.fileName}.png`)]] as const) {
        toolbar.append(Object.assign(document.createElement('button'), { textContent: label, onclick: run }))
      }
    }
    if (!toolbar.childElementCount) toolbar.remove()
    const stopArea = d3pAutoInteractionArea(chart) // before the objects: the tools, cursor and tooltip ask for an area
    scene.objects.forEach((o) => o.addToChart(chart))
    const stops = [scene.tooltip && d3pDomTooltip(scene.tooltip), scene.legend && d3pDomLegend(scene.legend)]
    return () => {
      stops.forEach((stop) => stop?.())
      stopArea()
      chart.destroy()
      scene.destroy()
      toolbar.remove()
      container.remove()
    }
  }
}
