import * as d3 from 'd3'
import type { D3PBus } from './bus'
import type { D3PChart } from './chart'
import type { D3PSubscriptions } from './bus'
import { D3PAxisDomain } from './domain'
import { D3PAttachable, D3PObject } from './object'
import { d3pToNumber } from './util'

/**
 * Options of a color scale: the domain of values, the interpolator of colors, the number of bins and whether it is reversed.
 */
export interface D3PColorScaleOptions {
  /** The bus the scale uses (the global bus by default). */
  bus?: D3PBus
  /** The values mapped to the two ends of the scale: a `D3PAxisDomain` (to share or to fit with an auto domain) or `[min, max]`. */
  domain?: D3PAxisDomain | [number, number]
  /** `t` in [0, 1] to a color; default `d3.interpolateYlOrRd`. Any `d3.interpolate*` scheme works. */
  interpolator?: (t: number) => string
  /** Number of color steps (a quantized, "binned" scale); default: continuous. */
  bins?: number
  /** Swap the two ends. */
  reverse?: boolean
}

/**
 * A sequential color scale for heatmaps. Its domain is a `D3PAxisDomain`, so it can be fitted to
 * data by an auto domain (`linkSeries(series, { value: scale.domain })`) and shared between charts.
 */
export class D3PColorScale extends D3PObject<{ changed: void }> {
  /** The domain of the values. Fit it to the data with an auto domain, or share it between charts. */
  readonly domain: D3PAxisDomain
  private _interpolator: (t: number) => string
  private _bins: number | undefined
  private _reverse: boolean

  constructor(opts: D3PColorScaleOptions = {}) {
    super('colorScale', ['changed'], opts.bus)
    this.domain = opts.domain instanceof D3PAxisDomain ? opts.domain : new D3PAxisDomain({ bus: this.bus, domain: opts.domain ?? [0, 1] })
    this._interpolator = opts.interpolator ?? d3.interpolateYlOrRd
    this._bins = opts.bins
    this._reverse = opts.reverse ?? false
    this.subs.add(this.bus.on(this.domain.e.domainChanged, () => this.fire(this.e.changed)))
  }

  /** The function that turns a position from 0 to 1 into a color (`d3.interpolateYlOrRd` by default). */
  get interpolator() {
    return this._interpolator
  }
  /** Sets the interpolator; the heatmaps that use the scale are drawn again. */
  set interpolator(f: (t: number) => string) {
    this._interpolator = f
    this.fire(this.e.changed)
  }
  /** The number of colors the scale is cut into, or `undefined` for a continuous gradient. */
  get bins() {
    return this._bins
  }
  /** Sets the number of colors; the heatmaps that use the scale are drawn again. */
  set bins(n: number | undefined) {
    this._bins = n
    this.fire(this.e.changed)
  }
  /** Whether the scale is reversed: the largest values get the first color. */
  get reverse() {
    return this._reverse
  }
  /** Reverses the scale or not; the heatmaps that use it are drawn again. */
  set reverse(v: boolean) {
    this._reverse = v
    this.fire(this.e.changed)
  }

  /** `[min, max]` as numbers. */
  extent(): [number, number] {
    const [a, b] = this.domain.domain
    return [d3pToNumber(a) ?? 0, d3pToNumber(b) ?? 1]
  }

  /** Position of `value` in the scale, 0 to 1 (clamped; stepped when the scale has bins). */
  position(value: number): number {
    const [lo, hi] = this.extent()
    let t = hi === lo ? 0.5 : (value - lo) / (hi - lo)
    t = Math.min(1, Math.max(0, t))
    if (this._bins && this._bins > 1) t = Math.min(this._bins - 1, Math.floor(t * this._bins)) / (this._bins - 1)
    return this._reverse ? 1 - t : t
  }

  /** The color of a value: the interpolator at its place in the domain, clamped to the ends. */
  color(value: number): string {
    return this._interpolator(this.position(value))
  }

  /** Evenly spaced stops from the low end to the high end, for a gradient. */
  stops(n = 24): { offset: number; color: string }[] {
    const [lo, hi] = this.extent()
    return Array.from({ length: n }, (_, i) => ({ offset: i / (n - 1), color: this.color(lo + ((hi - lo) * i) / (n - 1)) }))
  }

  protected override onDestroy(): void {
    this.domain.destroy()
  }
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

/**
 * Options of the legend of a color scale: the scale, its position (or inside the plot), its length, thickness and ticks, and its title.
 */
export interface D3PColorLegendOptions {
  /** The bus the legend uses (the global bus by default). */
  bus?: D3PBus
  /** The scale the legend shows. */
  scale: D3PColorScale
  /** Side of the chart it sits on (default `right`). */
  position?: 'right' | 'left' | 'top' | 'bottom'
  /**
   * `false` (default): outside of the plot, in the margin on that side, which must be large enough
   * (about 70 px on the right). `true`: over a corner of the plot.
   */
  inside?: boolean
  /** Length of the gradient bar and its thickness, in pixels. */
  length?: number
  /** Thickness of the gradient bar, in pixels. */
  thickness?: number
  /** The number of ticks along the bar. */
  tickCount?: number
  /** Writes the values of the ticks. */
  tickFormat?: (v: number) => string
  /** The title above the bar. */
  title?: string
}

interface ColorLegendData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  gradient: d3.Selection<SVGLinearGradientElement, unknown, null, undefined>
  id: string
}

/**
 * A gradient bar with a scale, for a `D3PColorScale`. Drawn in the chart's SVG (no HTML), so it
 * is part of exports.
 */
export class D3PColorLegend extends D3PAttachable<ColorLegendData> {
  /** The scale the legend shows. */
  readonly scale: D3PColorScale
  /** The side of the chart the legend goes on. */
  position: NonNullable<D3PColorLegendOptions['position']>
  /** Length of the gradient bar, in pixels. */
  length: number
  /** Thickness of the gradient bar, in pixels. */
  thickness: number
  /** Whether the legend floats over a corner of the plot instead of taking room in the margin. */
  inside: boolean
  /** The number of ticks along the bar. */
  tickCount: number
  /** Writes the values of the ticks. */
  tickFormat: ((v: number) => string) | undefined
  /** The title above the bar. */
  title: string | undefined

  constructor(opts: D3PColorLegendOptions) {
    super('colorLegend', [], opts.bus)
    this.scale = opts.scale
    this.position = opts.position ?? 'right'
    this.length = opts.length ?? 160
    this.thickness = opts.thickness ?? 12
    this.inside = opts.inside ?? false
    this.tickCount = opts.tickCount ?? 5
    this.tickFormat = opts.tickFormat
    this.title = opts.title
  }

  protected createData(chart: D3PChart): ColorLegendData {
    const id = `color-legend-${chart.id}-${Math.random().toString(36).slice(2, 8)}`
    const gradient = chart.defs.append('linearGradient').attr('id', id)
    const group = chart.layer.overlay.append('g').attr('class', 'color-legend').style('pointer-events', 'none')
    return { group, gradient, id }
  }

  protected attached(chart: D3PChart, _data: ColorLegendData, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(this.scale.e.changed, () => this.tagDirty(chart)))
    subs.add(this.bus.on(chart.e.resized, () => this.tagDirty(chart)))
    this.tagDirty(chart)
  }

  protected override detached(_chart: D3PChart, data: ColorLegendData): void {
    data.group.remove()
    data.gradient.remove()
  }

  /** Draws the gradient bar, its ticks and its title. */
  override render(chart: D3PChart): void {
    const data = this.chartData.get(chart)
    if (!data || this.isDestroying) return
    const { length, thickness, position } = this
    const vertical = position === 'right' || position === 'left'
    const [lo, hi] = this.scale.extent()

    data.gradient
      .attr('x1', '0%')
      .attr('y1', vertical ? '100%' : '0%') // low values at the bottom of a vertical bar
      .attr('x2', vertical ? '0%' : '100%')
      .attr('y2', '0%')
      .selectAll('stop')
      .data(this.scale.stops())
      .join('stop')
      .attr('offset', (s) => `${s.offset * 100}%`)
      .attr('stop-color', (s) => s.color)

    const margin = 8
    const room = 36 // for the tick labels
    const inside = {
      right: [chart.innerWidth - thickness - room - margin, margin + 14],
      left: [margin + room, margin + 14],
      top: [(chart.innerWidth - length) / 2, margin + 14],
      bottom: [(chart.innerWidth - length) / 2, chart.innerHeight - thickness - room / 2 - margin],
    }
    const outside = {
      right: [chart.innerWidth + 16, margin + 14],
      left: [-(thickness + room + 16), margin + 14],
      top: [(chart.innerWidth - length) / 2, -(thickness + 22)],
      bottom: [(chart.innerWidth - length) / 2, chart.innerHeight + 34],
    }
    const [x, y] = (this.inside ? inside : outside)[position]

    data.group.attr('transform', `translate(${x},${y})`).selectAll('*').remove()
    if (this.title) data.group.append('text').attr('y', -6).attr('font-size', 11).attr('fill', 'currentColor').text(this.title)
    data.group
      .append('rect')
      .attr('width', vertical ? thickness : length)
      .attr('height', vertical ? length : thickness)
      .attr('fill', `url(#${data.id})`)
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.3)
    const linear = d3.scaleLinear().domain([lo, hi]).range(vertical ? [length, 0] : [0, length])
    const axis = vertical ? (position === 'right' ? d3.axisRight(linear) : d3.axisLeft(linear)) : d3.axisBottom(linear)
    axis.ticks(this.tickCount).tickSize(4)
    if (this.tickFormat) axis.tickFormat(this.tickFormat as never)
    const g = data.group.append('g').attr('transform', vertical ? (position === 'right' ? `translate(${thickness},0)` : 'translate(0,0)') : `translate(0,${thickness})`)
    g.call(axis as never)
    g.select('.domain').remove()
    g.selectAll('text').attr('fill', 'currentColor')
  }

  protected override onDestroy(): void {
    super.onDestroy()
  }
}
