import { D3PObject } from './object'
import { d3pServiceKey } from './services'
import type { D3PChart } from './chart'
import type { D3PSeriesRenderer } from './renderers/base'

/** Key of the service that holds the series renderers of a chart (`chart.renderers`). */
export const D3P_RENDERERS = d3pServiceKey<D3PSeriesRendererManager>('seriesRenderers')

/** Per-chart registry of series renderers (several renderers may share a series name). */
export class D3PSeriesRendererManager extends D3PObject<{ seriesRendererListChanged: D3PSeriesRenderer[] }> {
  private list: D3PSeriesRenderer[] = []
  private offs = new Map<D3PSeriesRenderer, () => void>()

  constructor(/** The chart whose renderers it holds. */ readonly chart: D3PChart) {
    super(`${chart.name}.renderers`, ['seriesRendererListChanged'], chart.bus)
    this.subs.add(this.bus.on(chart.e.destroyed, () => this.destroy()))
  }

  /** Adds a renderer to the chart. */
  add(renderer: D3PSeriesRenderer): void {
    if (this.list.includes(renderer)) return
    this.list.push(renderer)
    this.offs.set(renderer, this.bus.on(renderer.e.destroyed, () => this.remove(renderer)))
    this.announce()
  }

  /** Removes a renderer from the chart. */
  remove(renderer: D3PSeriesRenderer): void {
    const i = this.list.indexOf(renderer)
    if (i < 0) return
    this.list.splice(i, 1)
    this.offs.get(renderer)?.()
    this.offs.delete(renderer)
    this.announce()
  }

  private announce() {
    if (!this.isDestroying) this.fire(this.e.seriesRendererListChanged, this.getSeries())
  }

  /** The renderers of the chart, in the order they were added. */
  getSeries(): D3PSeriesRenderer[] {
    return [...this.list]
  }

  /** The renderers of that name. */
  getSeriesByName(name: string): D3PSeriesRenderer[] {
    return this.list.filter((r) => r.name === name)
  }
}
