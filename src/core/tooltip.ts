import * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PAxisFilter } from './axis-manager'
import type { D3PChart } from './chart'
import { d3pJoinGroup, type D3PJoinGroup, type D3PJoinSpec } from './coords'
import { D3PHtmlContainer, type D3PHtmlChartData, type D3PHtmlContainerOptions } from './html'
import { d3pRequireInteractionArea } from './interaction'
import { D3PAttachable } from './object'
import type { D3PPointerEvent } from './pointer'
import { d3pProbe, type D3PProbeHit } from './probe'
import type { D3PSeriesRenderer } from './renderers/base'

/** Default text of a tooltip line: `label: value`, plus the share when the renderer splits a total. */
export function d3pTooltipText(s: D3PProbeHit): string {
  const name = s.label ?? s.renderer.name
  if (s.fields) return `${name}: ${s.fields.map((f) => `${f.name} ${f.format(f.value)}`).join(' · ')}`
  return `${name}: ${s.yFormatter(s.value ?? s.y)}${s.percent === undefined ? '' : ` (${Math.round(s.percent * 100)} %)`}`
}

/**
 * What a tooltip shows: where it is, on which side of the point to put the box, and what was found under the pointer for each series.
 */
export interface D3PTooltipData {
  /** Pixel position (inner coordinates). */
  x: number
  /** Y position of the point, in pixels (in the plot). */
  y: number
  /** Where to put the box relative to the point so that it stays inside the chart. */
  xSide: 'left' | 'right'
  /** Whether the box goes above or below the point to stay in the chart. */
  ySide: 'top' | 'bottom'
  /** What was found under the pointer, for each series. */
  series: D3PProbeHit[]
}

/**
 * Options of a tooltip: the renderers and axes it reads, and the joins between axes of different systems.
 */
export interface D3PTooltipManagerOptions {
  /** The bus the tooltip uses (the global bus by default). */
  bus?: D3PBus
  /** Restrict to some renderers (objects or names). */
  series?: ReadonlyArray<D3PSeriesRenderer | string>
  /** Restrict the tooltip to some axes (objects or names): it lists the values read on them. */
  axes?: D3PAxisFilter
  /**
   * Axes (of different systems, or charts) describing the same quantity, besides the joins
   * declared on the charts and the implicit ones (same name, same domain).
   */
  joins?: ReadonlyArray<D3PJoinSpec>
}

/**
 * Computes tooltip data from the mouse position (no drawing). Moving over any attached chart
 * produces data for every attached chart, at the same relative height, linked by axis name.
 * Per-chart `tooltipShow` / `tooltipHide` events are addressed to the charts, so use one
 * tooltip manager per chart (it may span several charts).
 */
export class D3PTooltipManager extends D3PAttachable<{}, { show: D3PTooltipData; hide: void }> {
  /** The renderers the tooltip is restricted to, if any. */
  readonly series: ReadonlyArray<D3PSeriesRenderer | string> | undefined
  /** The axes the tooltip is restricted to, if any. */
  readonly axes: D3PAxisFilter | undefined
  private readonly joins: D3PJoinGroup[]

  constructor(opts: D3PTooltipManagerOptions = {}) {
    super('tooltipManager', ['show', 'hide'], opts.bus)
    this.series = opts.series
    this.axes = opts.axes
    this.joins = (opts.joins ?? []).map(d3pJoinGroup)
  }

  protected createData() {
    return {}
  }

  protected attached(chart: D3PChart, _data: {}, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.event('mousemove'), (p) => this.hasChart(chart) && this.onMove(chart, p)))
    subs.add(this.bus.on(chart.event('mouseleave'), () => this.hasChart(chart) && this.hideAll()))
    d3pRequireInteractionArea(chart)
  }

  private hideAll() {
    for (const c of this.getCharts()) {
      c.emitEvent('tooltipHide', undefined as never)
      d3pProbe(c).hide()
    }
    this.fire(this.e.hide)
  }

  private onMove(origin: D3PChart, p: D3PPointerEvent) {
    const ratioY = origin.innerHeight ? p.y / origin.innerHeight : 0
    const all: D3PProbeHit[] = []
    // origin first, so its series lead the aggregated list
    for (const chart of [origin, ...this.getCharts().filter((c) => c !== origin)]) {
      const d = this.chartTooltip(chart, p, ratioY)
      // the origin's markers follow its own pointer events; the other charts are told here
      if (chart !== origin) d3pProbe(chart).show(p, this.joins)
      if (!d || !d.series.length) {
        chart.emitEvent('tooltipHide', undefined as never)
        continue
      }
      chart.emitEvent('tooltipShow', d)
      for (const s of d.series) if (!all.some((a) => a.renderer === s.renderer)) all.push(s)
    }
    if (!all.length) return this.fire(this.e.hide)
    this.fire(this.e.show, { x: p.x, y: p.y, xSide: p.x > origin.innerWidth / 2 ? 'left' : 'right', ySide: p.y > origin.innerHeight / 2 ? 'top' : 'bottom', series: all })
  }

  /**
   * Tooltip data of one chart for a pointer event. Each renderer looks at the value its X axis
   * should read (its own under the pointer, or a joined one), whatever the coordinate system it
   * draws in; the box is anchored at the first hit that has a position, or follows the pointer.
   */
  private chartTooltip(chart: D3PChart, event: D3PPointerEvent, ratioY: number): D3PTooltipData | undefined {
    const renderers = chart.renderers.getSeries().filter((r) => !this.series || this.series.some((f) => f === r || f === r.name))
    const series = d3pProbe(chart).hits(event, this.joins, renderers)
    if (!series.length) return undefined
    const pointer: [number, number] | undefined = event.chart === chart ? [event.x, event.y] : undefined
    let anchor: [number, number] | undefined
    for (const hit of series) {
      if (hit.range && hit.system) anchor = hit.system.tooltipAnchor(chart, hit.range[0], hit.range[1], ratioY, pointer)
      else anchor = pointer // no axes: the renderer reads the pointer itself
      if (anchor) break
    }
    const [ax, ay] = anchor ?? [0, ratioY * chart.innerHeight]
    return { x: ax, y: ay, xSide: ax > chart.innerWidth / 2 ? 'left' : 'right', ySide: ay > chart.innerHeight / 2 ? 'top' : 'bottom', series }
  }
}

// ---------------------------------------------------------------------------
// HTML container
// ---------------------------------------------------------------------------

/**
 * Options of the HTML container of a tooltip: those of an HTML container, and the offset of the box from the point.
 */
export interface D3PTooltipContainerOptions extends D3PHtmlContainerOptions {
  /** Distance of the box from the point, to its right, in pixels (10 by default). */
  offsetX?: number
  /** Distance of the box from the point, below it, in pixels (10 by default). */
  offsetY?: number
}

/** `foreignObject` hosting the tooltip content; positions it next to the point, clamped to the chart. */
export class D3PTooltipContainer extends D3PHtmlContainer<D3PTooltipData> {
  protected readonly fullSvg = false
  /** Distance of the box from the point, to its right, in pixels. */
  offsetX: number
  /** Distance of the box from the point, below it, in pixels. */
  offsetY: number

  constructor(opts: D3PTooltipContainerOptions = {}) {
    super('tooltipContainer', { ...opts, layer: opts.layer ?? ((l) => l.overlay) })
    this.offsetX = opts.offsetX ?? 10
    this.offsetY = opts.offsetY ?? 10
  }

  /** Gives the box its look: it is positioned by the library and lets the pointer through. */
  protected styleDiv(div: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
    div.style('position', 'absolute').style('pointer-events', 'none').style('display', 'none')
  }

  protected override attached(chart: D3PChart, data: D3PHtmlChartData<D3PTooltipData>, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.event('tooltipShow'), (tip) => this.setData(chart, tip)))
    subs.add(this.bus.on(chart.event('tooltipHide'), () => this.setData(chart, undefined)))
    super.attached(chart, data, subs)
  }

  /** Positions the box next to the point, inside the chart. */
  override render(chart: D3PChart): void {
    if (this.isDestroying) return
    const d = this.chartData.get(chart)
    if (!d) return
    const tip = d.data
    if (!tip) return void d.div.style('display', 'none')
    d.div.style('display', 'block')
    const rect = d.div.node()!.getBoundingClientRect()
    const w = rect.width || 100
    const h = rect.height || 50
    const left = tip.xSide === 'right' ? tip.x + this.offsetX : tip.x - w - this.offsetX
    const top = tip.ySide === 'bottom' ? tip.y + this.offsetY : tip.y - h - this.offsetY
    const clamp = (v: number, max: number) => Math.max(0, Math.min(v, Math.max(0, max)))
    d.div.style('left', `${clamp(left, chart.innerWidth - w)}px`).style('top', `${clamp(top, chart.innerHeight - h)}px`)
  }
}

/** Convenience bundle: manager + container attached together. */
export class D3PTooltip {
  /** The manager that tells what the tooltip shows. */
  readonly manager: D3PTooltipManager
  /** The container that draws the box. */
  readonly container: D3PTooltipContainer

  constructor(opts: D3PTooltipManagerOptions & D3PTooltipContainerOptions = {}) {
    this.manager = new D3PTooltipManager(opts)
    this.container = new D3PTooltipContainer(opts)
  }

  /** Attaches the manager and the container to the chart. */
  addToChart(chart: D3PChart) {
    this.manager.addToChart(chart)
    this.container.addToChart(chart)
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
