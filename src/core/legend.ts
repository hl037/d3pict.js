import type * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions, D3PUnsubscribe } from './bus'
import type { D3PChart } from './chart'
import { D3PHtmlContainer, type D3PHtmlContainerOptions } from './html'
import { D3PAttachable } from './object'
import type { D3PLegendItem, D3PSeriesRenderer } from './renderers/base'

/** A line of the legend and the renderer it belongs to; `toggle()` shows or hides what it stands for. */
export type D3PLegendEntry = D3PLegendItem & { renderer: D3PSeriesRenderer }

/** What a legend shows: one entry for each series, or each part of a pie. */
export interface D3PLegend {
  /** One entry for each series, or for each part of a pie. */
  series: D3PLegendEntry[]
}

/** Options of a legend: the renderers it lists. */
export interface D3PLegendManagerOptions {
  /** The bus the legend uses (the global bus by default). */
  bus?: D3PBus
  /** Restrict to some renderers (objects or names). */
  series?: ReadonlyArray<D3PSeriesRenderer | string>
}

interface LegendData {
  renderers: Map<D3PSeriesRenderer, D3PUnsubscribe[]>
}

/** Computes the legend of each chart from the entries of its renderers (names, colors, visibility). */
export class D3PLegendManager extends D3PAttachable<LegendData, { changed: D3PLegend }> {
  /** The renderers the legend is restricted to, if any. */
  readonly series: ReadonlyArray<D3PSeriesRenderer | string> | undefined

  constructor(opts: D3PLegendManagerOptions = {}) {
    super('legendManager', ['changed'], opts.bus)
    this.series = opts.series
  }

  protected createData(): LegendData {
    return { renderers: new Map() }
  }

  protected attached(chart: D3PChart, data: LegendData, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.renderers.e.seriesRendererListChanged, () => this.sync(chart, data)))
    this.sync(chart, data)
  }

  protected override detached(_chart: D3PChart, data: LegendData): void {
    for (const offs of data.renderers.values()) offs.forEach((o) => o())
    data.renderers.clear()
  }

  /** Re-subscribe to the renderers of the chart and announce the legend. */
  private sync(chart: D3PChart, data: LegendData) {
    if (!this.hasChart(chart)) return
    const current = new Set(chart.renderers.getSeries().filter((r) => this.accepts(r)))
    for (const [r, offs] of data.renderers) {
      if (!current.has(r)) {
        offs.forEach((o) => o())
        data.renderers.delete(r)
      }
    }
    for (const r of current) {
      if (data.renderers.has(r)) continue
      data.renderers.set(r, [
        this.bus.on(r.e.visibilityChanged, () => this.refresh(chart)),
        this.bus.on(r.e.entriesChanged, () => this.refresh(chart)),
        this.bus.on(r.e.destroyed, () => this.refresh(chart)),
      ])
    }
    this.refresh(chart)
  }

  private accepts(r: D3PSeriesRenderer) {
    return !this.series || this.series.some((f) => f === r || f === r.name)
  }

  /** What the legend shows for a chart: an entry for each part of the renderers it lists. */
  getLegend(chart: D3PChart): D3PLegend {
    return { series: chart.renderers.getSeries().filter((r) => this.accepts(r) && !r.isDestroying).flatMap((renderer) => renderer.legendEntries().map((item) => ({ ...item, renderer }))) }
  }

  /** Force the emission of the current legend of `chart`. */
  refresh(chart: D3PChart): void {
    if (!this.hasChart(chart) || this.isDestroying) return
    const legend = this.getLegend(chart)
    chart.emitEvent('legendChanged', legend)
    this.fire(this.e.changed, legend)
  }
}

/** `foreignObject` hosting the legend content; covers the whole SVG so it can sit in the margins. */
export class D3PLegendContainer extends D3PHtmlContainer<D3PLegend> {
  protected readonly fullSvg = true

  constructor(opts: D3PHtmlContainerOptions = {}) {
    super('legendContainer', opts)
  }

  /** Gives the `div` its look: its size and what lets the pointer through. */
  protected styleDiv(div: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
    div.style('position', 'relative').style('width', '100%').style('height', '100%').style('pointer-events', 'none')
  }

  protected override attached(chart: D3PChart, data: any, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.event('legendChanged'), (l) => this.setData(chart, l)))
    super.attached(chart, data, subs)
  }
}

/** Convenience bundle: legend manager + container. */
export class D3PLegendBundle {
  /** The manager that tells what the legend shows. */
  readonly manager: D3PLegendManager
  /** The container that draws the legend. */
  readonly container: D3PLegendContainer

  constructor(opts: D3PLegendManagerOptions & D3PHtmlContainerOptions = {}) {
    this.manager = new D3PLegendManager(opts)
    this.container = new D3PLegendContainer(opts)
  }

  /** Attaches the container and the manager to the chart, and shows the legend. */
  addToChart(chart: D3PChart) {
    this.container.addToChart(chart)
    this.manager.addToChart(chart)
    this.manager.refresh(chart)
  }
  /** Detaches the manager and the container from the chart. */
  removeFromChart(chart: D3PChart) {
    this.manager.removeFromChart(chart)
    this.container.removeFromChart(chart)
  }
  /** Destroys the manager and the container. */
  destroy() {
    this.manager.destroy()
    this.container.destroy()
  }
}
