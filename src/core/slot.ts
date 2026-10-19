import type * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PChart } from './chart'
import { D3PHtmlContainer, type D3PHtmlChartData } from './html'
import type { D3PBand, D3PBandSpan, D3PSide } from './layout'

/**
 * Options of a slot: the side it sits on, its size, its span, its order, and what it does when it is placed.
 */
export interface D3PSlotOptions {
  /** The bus the slot uses (the global bus by default). */
  bus?: D3PBus
  /**
   * Which side of the plot the slot sits on: it reserves a strip there, taken from the plot. `inside`
   * reserves nothing: the slot covers the plot, for something that floats over it (a legend in a corner).
   */
  side: D3PSide | 'inside'
  /** Height of a strip on the top or the bottom, width of a strip on the left or the right, in pixels (default 28). */
  size?: number
  /** Along the side: the whole chart, or only the plot (default), so a title is centered over the plot. */
  span?: D3PBandSpan
  /** Where the strip goes among those of its side: the lowest is the outermost (default 1; a title is 0, the title of an axis 2). */
  order?: number
  /**
   * Where the slot is, in the coordinates of the svg, when it is not on a strip (for a slot of `inside`
   * side): it is asked again whenever the chart changes size or its layout changes.
   */
  place?: (chart: D3PChart) => { x: number; y: number; width: number; height: number }
  /** CSS of the element that holds the content. */
  style?: Partial<CSSStyleDeclaration>
}

/**
 * Room around the plot, and an element to put things in. It reserves a strip of the layout on
 * one side of every chart it is attached to and gives each chart an HTML element placed on the
 * strip: fill it with anything, or let a framework render into it (`D3PVSlot`, `D3PRSlot`).
 *
 * It is what the standard titles and legend are made of; a component of your own is made the
 * same way, with a slot for its place and whatever it needs to draw in it.
 */
export class D3PSlot extends D3PHtmlContainer<undefined> {
  protected readonly fullSvg = false
  /** The side the slot is on, or `inside` for a slot that floats over the plot. */
  readonly side: D3PSide | 'inside'
  /** Along the whole chart, or along the plot. */
  readonly span: D3PBandSpan
  /** The rank of the strip among those of its side: the lower, the further from the plot. */
  readonly order: number
  private _size: number
  private readonly style: Partial<CSSStyleDeclaration>
  private readonly custom: D3PSlotOptions['place']
  private readonly bands = new Map<D3PChart, D3PBand>()

  constructor(opts: D3PSlotOptions) {
    super('slot', { bus: opts.bus, layer: (layers) => layers.frame })
    this.side = opts.side
    this.span = opts.span ?? 'plot'
    this.order = opts.order ?? 1
    this._size = opts.size ?? 28
    this.style = opts.style ?? {}
    this.custom = opts.place
  }

  /** The size of the strip, in pixels. */
  get size(): number {
    return this._size
  }
  /** Changes the size of the strip: the plot gives or takes the difference. */
  set size(value: number) {
    this._size = value
    for (const band of this.bands.values()) band.size = value
  }

  /**
   * The `div` covers its strip and lets the pointer through; its content opts in with `pointer-events: auto`.
   */
  protected styleDiv(div: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
    div.style('position', 'relative').style('width', '100%').style('height', '100%').style('pointer-events', 'none')
    Object.assign(div.node()!.style, this.style)
  }

  protected override createData(chart: D3PChart): D3PHtmlChartData<undefined> {
    const data = super.createData(chart)
    if (this.side !== 'inside') this.bands.set(chart, chart.layout.reserve(this.side, this._size, this.span, this.order))
    this.place(chart, data)
    return data
  }

  protected override attached(chart: D3PChart, data: D3PHtmlChartData<undefined>, subs: D3PSubscriptions): void {
    // the strip moves when the chart or another strip is resized
    subs.add(this.bus.on(chart.e.resized, () => this.place(chart, data)))
    super.attached(chart, data, subs)
  }

  protected override detached(chart: D3PChart, data: D3PHtmlChartData<undefined>): void {
    this.bands.get(chart)?.release()
    this.bands.delete(chart)
    super.detached(chart, data)
  }

  /** Put the element where it belongs again: after something it depends on, other than the size of the chart, changed. */
  update(chart: D3PChart): void {
    const data = this.chartData.get(chart)
    if (data) this.place(chart, data)
  }

  private place(chart: D3PChart, data: D3PHtmlChartData<undefined>) {
    const m = chart.margin
    const band = this.bands.get(chart)
    const rect = this.custom ? this.custom(chart) : band ? band.rect() : { x: m.left, y: m.top, width: chart.innerWidth, height: chart.innerHeight }
    data.fo.attr('x', rect.x).attr('y', rect.y).attr('width', rect.width).attr('height', rect.height)
  }
}
