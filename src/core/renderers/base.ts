import * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions, D3PUnsubscribe } from '../bus'
import type { D3PAxis, D3PAxisComponent } from '../axis'
import type { D3PAxisFilter } from '../axis-manager'
import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem, D3PJoinGroup } from '../coords'
import { d3pRequireInteractionArea } from '../interaction'
import type { D3PMarker } from '../marker'
import { D3PAttachable } from '../object'
import type { D3PPointerEvent } from '../pointer'
import { d3pNearestIndex, d3pProbe, type D3PProbeHit } from '../probe'
import { D3PViewportPoint, type D3PProjectionCache } from '../projection'
import { createProps, type D3PProps, type DeepPartial } from '../props'
import type { D3PSeries } from '../series'
import type { D3PDomainValue, D3PScale } from '../util'

/** Duration of the transitions of the renderers, in milliseconds. */
export const D3P_TRANSITION_MS = 200

/** The style every renderer has: its color (taken from its name when left empty). */
export interface D3PRendererStyleBase {
  /** The color of the renderer. Without one, it is taken from the name. */
  color: string
}

/**
 * Options of a series renderer: the series, the axes and the system it draws in, its name, its marker and its props.
 */
export interface D3PSeriesRendererOptions<P extends object> {
  /** The bus the renderer uses (the global bus by default). */
  bus?: D3PBus
  /** The series the renderer draws. */
  series: D3PSeries
  /** Axes (objects or names) restricting where the renderer looks for its X and Y axes. */
  axes?: D3PAxisFilter
  /**
   * Coordinate system the renderer draws in. Without it, the renderer takes the first X axis
   * of the chart and the first Y axis of the same system.
   */
  system?: string
  /** Default: the series name. */
  name?: string
  /** What shows the point under the pointer: a marker, or `false` for none. Default: `createMarker()`. */
  marker?: D3PMarker | false
  /** Initial props: the style and what the type of renderer adds. */
  props?: DeepPartial<P>
}

/** One line of a legend. Most renderers have one (themselves); a pie has one per slice. */
export interface D3PLegendItem {
  /** Unique among the items of a renderer. */
  key: string
  /** Text of the entry. */
  label: string
  /** Color of the entry. */
  color: string
  /** Whether it is shown. */
  visible: boolean
  /** Shows or hides what the entry stands for. */
  toggle(): void
}

/**
 * What a renderer keeps for a chart: the axes it found, its subscriptions to their scales, the pending request for a transition, and its own state.
 */
export interface D3PRendererChartData<G = unknown> {
  /** `null` = no request, `true` = animate, `false` = a non-animated request is in the batch. */
  transition: boolean | null
  /** The X axis the renderer drew against. */
  x?: D3PAxis
  /** The Y axis the renderer drew against. */
  y?: D3PAxis
  /** Subscribed `scaleChanged` listeners by axis. */
  axisSubs: Map<D3PAxis, D3PUnsubscribe>
  /** Renderer-specific state. */
  data: G
  /** `chartAdded` completed (so `chartRemoved` has something to undo). */
  added?: boolean
}

/**
 * The color a renderer takes from its name, when it is not given one: the same name always gives the same color.
 */
export function d3pDefaultColor(name: string): string {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return d3.schemeCategory10[sum % 10]
}

type Group = d3.Selection<SVGGElement, unknown, null, undefined>

/**
 * Base of every series renderer. Subtypes provide the props defaults and the drawing hooks.
 * A redraw asked by a change of the data, of the props or of the series is animated, even when the
 * scale changes in the same frame (an auto domain fitting new data). A scale change alone is drawn
 * at once, so panning/zooming never lags behind the pointer.
 */
export abstract class D3PSeriesRenderer<P extends { style: D3PRendererStyleBase } = any, G = any> extends D3PAttachable<
  D3PRendererChartData<G>,
  { visibilityChanged: boolean; entriesChanged: void }
> {
  private static counter = 0

  /** A number that identifies the renderer: 1 for the first one created. */
  readonly id = ++D3PSeriesRenderer.counter
  /** The name of the renderer: the series name unless given. */
  readonly name: string
  /** The axes the renderer is restricted to (objects or names), if any. */
  readonly axes: D3PAxisFilter | undefined
  /** The name of the coordinate system the renderer draws in, if it was given one. */
  readonly system: string | undefined
  /** Kinds of coordinate system the renderer can draw in (`undefined`: any). */
  protected readonly systemKinds: readonly string[] | undefined = undefined
  /** Columns the series must have (`['open', 'high', 'low', 'close']`); checked when attaching. */
  protected readonly requiredColumns: readonly string[] = []
  /** The props and their change hooks. */
  protected readonly propsHandle: ReturnType<typeof createProps<P & { visible: boolean }>>
  private _series: D3PSeries
  private seriesOff: D3PUnsubscribe | undefined
  private _marker: D3PMarker | undefined

  constructor(opts: D3PSeriesRendererOptions<P>, defaults: P) {
    super(`seriesRenderer[${opts.name ?? opts.series.name}]`, ['visibilityChanged', 'entriesChanged'], opts.bus)
    this._series = opts.series
    this.name = opts.name ?? opts.series.name
    this.axes = opts.axes
    this.system = opts.system
    this.propsHandle = createProps<P & { visible: boolean }>(
      { ...defaults, visible: true, style: { ...defaults.style, color: d3pDefaultColor(this.name) } } as P & { visible: boolean },
      { afterSet: () => this.tagDirtyWithTransition() },
    )
    if (opts.props) this.propsHandle.props(opts.props as DeepPartial<P & { visible: boolean }>)
    this.subscribeSeries()
    this._marker = opts.marker === false ? undefined : (opts.marker ?? this.createMarker())
  }

  // ----- marker -----

  /** What shows the point under the pointer; `undefined` for none. */
  get marker(): D3PMarker | undefined {
    return this._marker
  }
  /** Replaces the marker, or removes it with `undefined`. */
  set marker(m: D3PMarker | undefined) {
    if (m === this._marker) return
    for (const c of this.getCharts()) this._marker?.remove(c)
    this._marker = m
    if (m?.interactive) for (const c of this.getCharts()) d3pRequireInteractionArea(c)
  }

  /** The marker this kind of renderer has by default (none unless overridden). */
  createMarker(): D3PMarker | undefined {
    return undefined
  }

  // ----- props / accessors -----

  /** The props of the renderer: its style, what its type adds, and `visible`. */
  get props(): D3PProps<P & { visible: boolean }> {
    return this.propsHandle.props
  }
  /** Merges props into those of the renderer; it is drawn again, with a transition. */
  set props(v: DeepPartial<P & { visible: boolean }>) {
    this.propsHandle.replace(v)
  }

  /** The series the renderer draws. */
  get series(): D3PSeries {
    return this._series
  }
  /** Changes the series: the renderer is drawn again. */
  set series(s: D3PSeries) {
    if (s === this._series) return
    this.checkColumns(s)
    this.seriesOff?.()
    this._series = s
    this.subscribeSeries()
    this.seriesChanged()
    this.tagDirtyWithTransition()
  }

  /** Whether the renderer is shown. */
  get visible(): boolean {
    return this.props.visible
  }
  /** Shows or hides the renderer, with a transition. */
  set visible(v: boolean) {
    if (v === this.props.visible) return
    this.propsHandle.props({ visible: v } as DeepPartial<P & { visible: boolean }>)
    this.fire(this.e.visibilityChanged, v)
  }

  /** The color of the renderer: the one in its style, or the one its name gives. */
  get color(): string {
    return this.props.style.color
  }

  private subscribeSeries() {
    this.seriesOff = this.bus.on(this._series.e.dataChanged, () => {
      this.tagDirtyWithTransition()
      this.seriesChanged()
    })
    // dropped together with the renderer
  }

  /** The series, or its data, changed. Renderers whose legend depends on the data announce it here. */
  protected seriesChanged(): void {}

  /** Announce that `legendEntries()` changed (the legend refreshes). */
  protected entriesChanged(): void {
    this.fire(this.e.entriesChanged)
  }

  /** The legend lines of this renderer: itself by default. */
  legendEntries(): D3PLegendItem[] {
    return [{ key: 'series', label: this.name, color: this.color || '#4682b4', visible: this.visible, toggle: () => (this.visible = !this.visible) }]
  }

  /**
   * What this renderer finds for `event` on `chart`: by default the data point whose X is closest
   * to the value under the pointer (read through the probe, so joins apply). Renderers that do
   * not map data through axes (a pie) test the pixel instead. Ask the probe (`d3pProbe(chart).hit`)
   * rather than this method: it computes once per event.
   */
  probeHit(chart: D3PChart, event: D3PPointerEvent, joins: readonly D3PJoinGroup[] = []): D3PProbeHit | undefined {
    const { x, y } = this.getAxes(chart)
    const system = x?.getSystem(chart)
    if (!x || !y || !system) return undefined
    const value = d3pProbe(chart).projectFrom(event, x, joins)
    if (value === undefined) return undefined
    const index = d3pNearestIndex(this.series.data, value)
    const pt = this.series.data[index]
    if (!pt) return undefined
    const hit: D3PProbeHit = { renderer: this, x: pt[0], y: pt[1], index, xFormatter: x.getTickFormatter(chart), yFormatter: y.getTickFormatter(chart), color: this.color || '#4682b4' }
    const ser = this.series
    if (ser.display !== ser.columns[1]) {
      hit.value = pt[ser.index(ser.display)]
      if (ser.displayFormat) hit.yFormatter = ser.displayFormat
    } else if (ser.tooltipColumns.length > 1) {
      const fmt = hit.yFormatter
      hit.fields = ser.inputColumns
        .slice(1)
        .filter((c) => ser.tooltipColumns.includes(c))
        .map((name) => ({ name, value: pt[ser.index(name)], format: (v: any) => (Array.isArray(v) ? v.map(fmt).join(', ') : fmt(v)) }))
    }
    const range = this.projectToRange(chart, pt[0], pt[1])
    if (range) {
      hit.system = system
      hit.range = range
    }
    return hit
  }

  /** Throws when the series lacks a column this renderer reads. */
  protected checkColumns(series: D3PSeries = this._series): void {
    const missing = this.requiredColumns.filter((c) => !series.has(c))
    if (missing.length) {
      throw new Error(
        `[d3pict] renderer "${this.name}" (${this.constructor.name}) needs the column${missing.length > 1 ? 's' : ''} ${missing.join(', ')}, but series "${series.name}" has ${series.columns.join(', ')}; declare them with the "columns" option of the series`,
      )
    }
  }

  protected override onDestroy(): void {
    this.seriesOff?.()
    super.onDestroy()
  }

  // ----- scheduling -----

  /** Asks to draw again, with a transition: on one chart, or on all of them. */
  tagDirtyWithTransition(chart?: D3PChart): void {
    this.requestRender(chart, true)
  }

  override tagDirty(chart?: D3PChart): void {
    this.requestRender(chart, false)
  }

  private requestRender(chart: D3PChart | undefined, transition: boolean) {
    for (const c of chart ? [chart] : this.getCharts()) {
      const d = this.chartData.get(c)
      if (!d) continue
      d.transition = transition || d.transition === true
      super.tagDirty(c)
    }
  }

  // ----- attach -----

  protected createData(chart: D3PChart): D3PRendererChartData<G> {
    return { transition: null, axisSubs: new Map(), data: this.createRendererData(chart) }
  }

  protected attached(chart: D3PChart, data: D3PRendererChartData<G>, subs: D3PSubscriptions): void {
    this.checkColumns()
    d3pProbe(chart).track()
    if (this._marker?.interactive) d3pRequireInteractionArea(chart)
    subs.add(this.bus.on(chart.axes.e.axesListChanged, () => this.tagDirtyWithTransition(chart)))
    this.chartAdded(chart, data.data)
    data.added = true
    chart.renderers.add(this)
    this.tagDirtyWithTransition(chart)
  }

  protected override detached(chart: D3PChart, data: D3PRendererChartData<G>): void {
    this._marker?.remove(chart)
    chart.renderers.remove(this)
    if (data.added) this.chartRemoved(chart, data.data)
    this.groups.delete(chart)
    for (const off of data.axisSubs.values()) off()
    data.axisSubs.clear()
  }

  /**
   * Axes this renderer draws against on `chart`: the one the series' `x` is plotted on, and the
   * one for its `y`. By default the first X-component axis and the first Y-component axis of the
   * same coordinate system; a horizontal renderer swaps them.
   */
  getAxes(chart: D3PChart): { x?: D3PAxis; y?: D3PAxis } {
    const state = chart.axes.getAxesState(this.axes)
    const inSystem = (a: D3PAxis) => this.system === undefined || a.systemName === this.system
    const xs = state.x.filter(inSystem)
    const ys = state.y.filter(inSystem)
    const x = xs[0]
    if (!x) return { y: ys[0] }
    const system = x.getSystem(chart)
    const y = ys.find((a) => a.getSystem(chart) === system)
    if (!y && ys.length) {
      throw new Error(
        `[d3pict] renderer "${this.name}": X axis "${x.name}" is on system "${x.systemName}" but the Y axes (${ys.map((a) => `"${a.name}" on "${a.systemName}"`).join(', ')}) are not; select the axes with the "axes" or "system" option`,
      )
    }
    return { x, y }
  }

  /**
   * Position of the data point `(x, y)` in range units, in the order of the dimensions of the
   * system (the series' `x` goes on the first dimension unless the renderer is horizontal).
   */
  projectToRange(chart: D3PChart, x: D3PDomainValue, y: D3PDomainValue, cache?: D3PProjectionCache): [number, number] | undefined {
    const axes = this.getAxes(chart)
    if (!axes.x || !axes.y) return undefined
    const p = axes.x.projectTo(chart, x, cache)
    const q = axes.y.projectTo(chart, y, cache)
    if (p === undefined || q === undefined) return undefined
    return axes.x.component === 'x' ? [p, q] : [q, p]
  }

  /** Viewport point of the data point `(x, y)`. */
  projectTo(chart: D3PChart, x: D3PDomainValue, y: D3PDomainValue, cache?: D3PProjectionCache): D3PViewportPoint | undefined {
    const system = this.getAxes(chart).x?.getSystem(chart)
    const range = this.projectToRange(chart, x, y, cache)
    return system && range ? system.projectTo(chart, range[0], range[1], cache) : undefined
  }

  /** Data values `[x, y]` under a viewport point; `undefined` outside of the system. */
  projectFrom(point: D3PViewportPoint, cache?: D3PProjectionCache): [D3PDomainValue, D3PDomainValue] | undefined {
    const { x, y } = this.getAxes(point.chart)
    const vx = x?.projectFrom(point, undefined, cache)
    const vy = y?.projectFrom(point, undefined, cache)
    return vx === undefined || vy === undefined ? undefined : [vx, vy]
  }

  /** Keep one `scaleChanged` listener per used axis, drop the others. */
  private syncAxisSubs(chart: D3PChart, d: D3PRendererChartData<G>) {
    const used = new Set([d.x, d.y].filter((a): a is D3PAxis => !!a))
    for (const [axis, off] of d.axisSubs) {
      if (!used.has(axis)) {
        off()
        d.axisSubs.delete(axis)
      }
    }
    for (const axis of used) {
      if (d.axisSubs.has(axis)) continue
      d.axisSubs.set(
        axis,
        this.bus.on(axis.e.scaleChanged, (p) => {
          if (p.chart === chart) this.tagDirty(chart)
        }),
      )
    }
  }

  // ----- render -----

  override async render(chart: D3PChart): Promise<void> {
    if (this.isDestroying) return
    const d = this.chartData.get(chart)
    if (!d) return
    const { x, y } = this.getAxes(chart)
    d.x = x
    d.y = y
    this.syncAxisSubs(chart, d)
    this.groups.get(chart)?.attr('clip-path', x?.getSystem(chart)?.clipPath(chart) ?? null)
    const transition = d.transition === true
    d.transition = null
    if (this.visible) {
      if (transition) this.renderDataWithTransition(chart, d.data, x, y)
      else this.renderData(chart, d.data, x, y)
    } else this.renderDataHidden(chart, d.data, x, y)
  }

  // ----- subtype contract -----

  /** Creates what the renderer keeps for a chart. */
  protected abstract createRendererData(chart: D3PChart): G
  /** Called when the renderer is attached to a chart, to create what it draws with. */
  protected abstract chartAdded(chart: D3PChart, data: G): void
  /** Called when the renderer leaves a chart, to remove what it created. */
  protected abstract chartRemoved(chart: D3PChart, data: G): void
  /** Draws the series at once, with no transition. */
  protected abstract renderData(chart: D3PChart, data: G, x?: D3PAxis, y?: D3PAxis): void
  /** Draws the series moving from what is on screen to what the data and the scales say now. */
  protected abstract renderDataWithTransition(chart: D3PChart, data: G, x?: D3PAxis, y?: D3PAxis): void
  /** Draws the series going away: the renderer was hidden. */
  protected abstract renderDataHidden(chart: D3PChart, data: G, x?: D3PAxis, y?: D3PAxis): void

  /** Create the renderer's own group in the middle data layer. */
  protected createGroup(chart: D3PChart): Group {
    const group = chart.layer.data.middle.append('g').attr('class', `series-renderer series-renderer-${this.id}`)
    this.groups.set(chart, group)
    return group
  }

  /** Groups created by `createGroup`, to clip them to the shape of their coordinate system. */
  private readonly groups = new Map<D3PChart, Group>()

  /** Scales and coordinate system to draw with; throws if the system is not one the renderer supports. */
  protected scalesOf(chart: D3PChart, x?: D3PAxis, y?: D3PAxis): { sx: D3PScale; sy: D3PScale; system: D3PCoordinateSystem } | undefined {
    const sx = x?.getScale(chart)
    const sy = y?.getScale(chart)
    const system = x?.getSystem(chart)
    if (!sx || !sy || !system) return undefined
    if (this.systemKinds && !this.systemKinds.includes(system.kind)) {
      throw new Error(
        `[d3pict] renderer "${this.name}" (${this.constructor.name}) does not support the ${system.kind} coordinate system "${system.name}" of its axes; it supports: ${this.systemKinds.join(', ')}`,
      )
    }
    return { sx, sy, system }
  }
}

export type { D3PAxisComponent }
