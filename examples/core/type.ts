import { D3PChart, d3pAutoInteractionArea, d3pDomLegend, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { GALLERY } from '../scenarios/gallery'

/** Core only: the chart of one scene of the gallery. */
export function mountType(id: string) {
  return (root: HTMLElement) => {
    const bus = getGlobalBus()
    const scene = GALLERY.find((g) => g.id === id)!.build(bus)
    const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
    root.append(container)
    const chart = new D3PChart({ container, bus, margin: scene.margin })
    const stopArea = d3pAutoInteractionArea(chart) // before the objects: the cursor and the tooltip ask for an area
    scene.objects.forEach((o) => o.addToChart(chart))
    const stops = [scene.tooltip && d3pDomTooltip(scene.tooltip), scene.legend && d3pDomLegend(scene.legend)]
    return () => {
      stops.forEach((stop) => stop?.())
      stopArea()
      chart.destroy()
      scene.destroy()
      container.remove()
    }
  }
}
