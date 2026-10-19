import type * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PChart, D3PChartLayers } from './chart'
import { D3PAttachable } from './object'

/** What an HTML container keeps for a chart: its `foreignObject`, its `div` and its own data. */
export interface D3PHtmlChartData<D> {
  /** The `foreignObject` that holds the `div` in the svg. */
  fo: d3.Selection<SVGForeignObjectElement, unknown, null, undefined>
  /** The `div` the HTML content goes in. */
  div: d3.Selection<HTMLDivElement, unknown, null, undefined>
  /** What the container shows, if anything (the data of a tooltip). */
  data: D | undefined
}

/** Options of an HTML container: the bus, and the layer of the chart that receives it. */
export interface D3PHtmlContainerOptions {
  /** The bus the container uses (the global bus by default). */
  bus?: D3PBus
  /**
   * Layer receiving the `foreignObject`. Default: `interaction.front`, above the interaction area,
   * so that clickable content (a legend, an anchor) is not covered by it. The `foreignObject` itself
   * lets the pointer through; only the content opts in with `pointer-events: auto`.
   */
  layer?: (layers: D3PChartLayers) => d3.Selection<SVGGElement, unknown, null, undefined>
}

/**
 * Per-chart `foreignObject` + `div` into which a framework renders HTML content (Vue
 * Teleport / React portal). `changed` is emitted whenever a chart is added or removed.
 */
export abstract class D3PHtmlContainer<D = undefined> extends D3PAttachable<D3PHtmlChartData<D>, { changed: void }> {
  private readonly layerOf: (layers: D3PChartLayers) => d3.Selection<SVGGElement, unknown, null, undefined>

  constructor(label: string, opts: D3PHtmlContainerOptions = {}) {
    super(label, ['changed'], opts.bus)
    this.layerOf = opts.layer ?? ((l) => l.interaction.front)
  }

  /** `true`: the foreignObject covers the whole SVG (margins included); `false`: the inner area only. */
  protected abstract readonly fullSvg: boolean
  /** Gives the `div` its look: its position, its size and what lets the pointer through. */
  protected abstract styleDiv(div: d3.Selection<HTMLDivElement, unknown, null, undefined>): void

  protected createData(chart: D3PChart): D3PHtmlChartData<D> {
    const fo = this.layerOf(chart.layer)
      .append('foreignObject')
      .attr('class', 'html-container')
      .attr('x', this.fullSvg ? -chart.margin.left : 0)
      .attr('y', this.fullSvg ? -chart.margin.top : 0)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('overflow', 'visible')
      .style('pointer-events', 'none')
    const div = fo.append('xhtml:div') as d3.Selection<HTMLDivElement, unknown, null, undefined>
    this.styleDiv(div)
    return { fo, div, data: undefined }
  }

  protected attached(chart: D3PChart, data: D3PHtmlChartData<D>, subs: D3PSubscriptions): void {
    // a container that covers the whole svg starts at the corner of the svg, wherever the plot is
    if (this.fullSvg) subs.add(this.bus.on(chart.e.resized, () => data.fo.attr('x', -chart.margin.left).attr('y', -chart.margin.top)))
    this.fire(this.e.changed)
  }

  protected override detached(_chart: D3PChart, data: D3PHtmlChartData<D>): void {
    data.fo.remove()
    if (!this.isDestroying) this.fire(this.e.changed)
  }

  /** The `div` on a chart, where a framework mounts its content. */
  getContainer(chart: D3PChart): HTMLDivElement | undefined {
    return this.chartData.get(chart)?.div.node() ?? undefined
  }

  /** What the container shows on a chart. */
  getData(chart: D3PChart): D | undefined {
    return this.chartData.get(chart)?.data
  }

  /** The `div` of each chart the container is attached to, with the chart and its data. */
  getContainers(): { chart: D3PChart; container: HTMLDivElement; data: D | undefined }[] {
    return [...this.chartData].map(([chart, d]) => ({ chart, container: d.div.node()!, data: d.data }))
  }

  /** Calls `cb` for each chart, with its `div` and its data. */
  forEachContainer(cb: (e: { chart: D3PChart; container: HTMLDivElement; data: D | undefined }) => void): void {
    this.getContainers().forEach(cb)
  }

  /** Sets what the container shows on a chart and draws it again. */
  protected setData(chart: D3PChart, data: D | undefined) {
    const d = this.chartData.get(chart)
    if (!d) return
    d.data = data
    this.tagDirty(chart)
  }
}

/** Generic anchor: place any framework-rendered HTML content inside a chart. */
export class D3PAnchor extends D3PHtmlContainer {
  protected readonly fullSvg = true

  constructor(opts: D3PHtmlContainerOptions = {}) {
    super('anchor', opts)
  }

  /**
   * The `div` covers the plot and lets the pointer through; its content opts in with `pointer-events: auto`.
   */
  protected styleDiv(div: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
    div.style('position', 'relative').style('width', '100%').style('height', '100%').style('pointer-events', 'none')
  }
}

