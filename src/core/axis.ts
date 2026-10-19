import * as d3 from 'd3'
import type { D3PBus } from './bus'
import { D3PCartesianAxisRenderer, d3pDefaultAxisRenderer, type D3PAxisRenderer } from './axis-renderer'
import type { D3PChart } from './chart'
import type { D3PCoordinateSystem, D3PSystemSnapshot } from './coords'
import type { D3PAxisDomain } from './domain'
import { D3PAttachable } from './object'
import { d3pMemo, type D3PProjectionCache, type D3PViewportPoint } from './projection'
import { createProps, type D3PProps, type DeepPartial } from './props'
import type { D3PSubscriptions } from './bus'
import { d3pDefaultFormatter, d3pScaleFactory, d3pScaleProjectFrom, d3pScaleProjectTo, type D3PDomainValue, type D3PScale, type D3PScaleOptions, type D3PScaleType } from './util'

/**
 * Where the axis is drawn. `angle` and `radius` are the polar counterparts of `bottom`/`top`
 * (first dimension, component `x`) and `left`/`right` (second dimension, component `y`).
 */
export type D3PAxisPosition = 'bottom' | 'top' | 'left' | 'right' | 'angle' | 'radius'
/** First (`x`) or second (`y`) dimension of the axis' coordinate system. */
export type D3PAxisComponent = 'x' | 'y'

/** Props of the grid of an axis: whether it is drawn, and its stroke, width, dash and opacity. */
export interface D3PAxisGridProps {
  /** Whether the grid is drawn. */
  enabled: boolean
  /** Color of the grid lines. */
  stroke: string
  /** Width of the grid lines, in pixels. */
  strokeWidth: number
  /** Dash of the grid lines, as an SVG `stroke-dasharray` (`'2,2'`). */
  strokeDasharray: string
  /** Opacity of the grid lines (0 to 1). */
  opacity: number
}

/**
 * Props of an axis: the name it shows, the grid, the number of ticks, how a value is written (`tickFormat`) and a hook to change the drawing (`postProcess`).
 */
export interface D3PAxisProps {
  /** The name the axis shows (the text of its title): the name of the axis by default. */
  displayName: string
  /** The grid drawn from the ticks. */
  grid: D3PAxisGridProps
  /** The number of ticks wanted (d3 may give a few more or less). */
  tickCount: number
  /**
   * Writes a value, for the ticks and the labels of the cursor and the tooltip. `null`: the default format of the scale. A cursor label is not a tick: round its value.
   */
  tickFormat: ((v: any) => string) | null
  /** Called after each draw with the axis group, to customize the SVG. */
  postProcess: (group: d3.Selection<SVGGElement, unknown, null, undefined>) => void
}

/**
 * Options of an axis: its name, its domain, its position, its offset, the system it is in, its renderer, its scale type and options, and its props.
 */
export interface D3PAxisOptions {
  /** The bus the axis uses (the global bus by default). */
  bus?: D3PBus
  /** Identifier in the axis manager, tool filters and mapped coordinates. */
  name: string
  /** The domain the axis reads. Axes (of any chart) that share a domain move together. */
  domain: D3PAxisDomain
  /**
   * Default `bottom`. The component (x/y) and the default coordinate system (cartesian for the
   * four sides, polar for `angle`/`radius`) are deduced from it.
   */
  position?: D3PAxisPosition
  /** Name of the coordinate system on the chart; default `cartesian` or `polar` after the position. */
  system?: string
  /**
   * Pixels between the plot and a side axis (default 0): several axes on one side stack up by
   * giving each a larger offset, outward (left and top axes move left and up, right and bottom axes right and down). Leave room for them with the chart's margins.
   */
  offset?: number
  /** How the axis is drawn; default after the position. Throws if it does not support the position. */
  renderer?: D3PAxisRenderer
  /** The type of scale (`linear` by default; `band` for categories, `time` for dates). */
  scaleType?: D3PScaleType
  /** Options of the scale: the base of a log scale, the exponent of a power scale. */
  scaleOptions?: D3PScaleOptions
  /** Initial props of the axis. */
  props?: DeepPartial<D3PAxisProps>
}

interface AxisChartData {
  system: D3PCoordinateSystem
  scale: D3PScale
  group?: d3.Selection<SVGGElement, unknown, null, undefined>
  gridGroup?: d3.Selection<SVGGElement, unknown, null, undefined>
  visible: boolean
  offset: number
}

type Sel = d3.Selection<SVGGElement, unknown, null, undefined>

/** Projections of an axis, live (`D3PAxis`) or frozen (`D3PAxisSnapshot`). */
export interface D3PAxisProjector {
  /** Domain value to its position in range units (centered in the band of a band scale). */
  projectTo(chart: D3PChart, value: D3PDomainValue, cache?: D3PProjectionCache): number | undefined
  /**
   * Viewport point to the domain value under it, through the system of the axis. `undefined`
   * outside of the system (unless `strict` is `false`) or between the bands of a band scale.
   */
  projectFrom(point: D3PViewportPoint, options?: { strict?: boolean }, cache?: D3PProjectionCache): D3PDomainValue | undefined
}

/**
 * An axis as it was when `snapshot` was called: its domain, and the scale and system that went
 * with it. A tool that compares the start of a gesture with the live state uses it; the live
 * axis keeps moving while the gesture writes its domain.
 */
export class D3PAxisSnapshot implements D3PAxisProjector {
  /** `x` or `y`: the dimension of the axis. */
  readonly component: D3PAxisComponent
  /** The domain at the time of the snapshot. */
  readonly domain: D3PDomainValue[]
  private built: D3PScale | undefined

  constructor(
    /** The axis this snapshot was taken of. */
    readonly axis: D3PAxis,
    /** The chart it was taken on. */
    readonly chart: D3PChart,
    /** The coordinate system of the axis, as it was at the time of the snapshot. */
    readonly system: D3PSystemSnapshot,
  ) {
    this.component = axis.component
    this.domain = [...axis.domain.domain]
  }

  /** The scale of the snapshot (built on first use). */
  get scale(): D3PScale {
    return (this.built ??= d3pScaleFactory(this.axis.scaleType, { ...this.axis.scaleOptions, domain: this.domain, range: this.system.ranges(this.chart)[this.component] }))
  }

  private check(chart: D3PChart) {
    if (chart !== this.chart) throw new Error(`[d3pict] a snapshot of chart "${this.chart.name}" cannot project on chart "${chart.name}"`)
  }

  /** The place of a value along this axis, in range units, as it was at the time of the snapshot. */
  projectTo(chart: D3PChart, value: D3PDomainValue, cache?: D3PProjectionCache): number | undefined {
    this.check(chart)
    return d3pMemo(cache, this, chart, ['to', value], () => d3pScaleProjectTo(this.scale, value))
  }

  /** The value of this axis under a point of the chart, as it was at the time of the snapshot. */
  projectFrom(point: D3PViewportPoint, options: { strict?: boolean } = {}, cache?: D3PProjectionCache): D3PDomainValue | undefined {
    this.check(point.chart)
    const strict = options.strict ?? true
    return d3pMemo(cache, this, point.chart, ['from', point.x, point.y, strict], () => {
      const u = this.system.projectFrom(point, { strict }, cache)
      return u ? d3pScaleProjectFrom(this.scale, u[this.component === 'x' ? 0 : 1]) : undefined
    })
  }
}

/**
 * An axis: a name, a domain, a position and a type of scale. It is attached to charts like any object, and draws its line, its ticks, its labels and its grid. Axes that share a `D3PAxisDomain` move together, on one chart or on several.
 *
 * The axis gives the scale of its domain on each chart (`getScale`), and converts between values and positions (`projectTo`, `projectFrom`).
 */
export class D3PAxis extends D3PAttachable<
  AxisChartData,
  {
    visibilityChanged: { target: D3PChart | undefined; visible: boolean }
    /** Emitted after the scale of `chart` was updated. Pixel consumers listen to this. */
    scaleChanged: { chart: D3PChart }
  }
> {
  /** The name of the axis. It is unique among the axes of a dimension in a chart. */
  readonly name: string
  /** The domain the axis reads. */
  readonly domain: D3PAxisDomain
  /** Where the axis is drawn: `bottom`, `top`, `left`, `right`, or `angle` and `radius` in polar. */
  readonly position: D3PAxisPosition
  /** `x` or `y`: the dimension of the axis (the angle is `x` and the radius `y` in polar). */
  readonly component: D3PAxisComponent
  /** The name of the coordinate system the axis is in. */
  readonly systemName: string
  /** What draws the axis: a line along a side, a ring, a radius. */
  readonly renderer: D3PAxisRenderer
  /** The type of scale. */
  readonly scaleType: D3PScaleType
  /** Options of the scale. */
  readonly scaleOptions: D3PScaleOptions
  private pendingOffset: number
  private readonly propsHandle = createProps<D3PAxisProps>(
    {
      displayName: '',
      grid: { enabled: false, stroke: '#000', strokeWidth: 1, strokeDasharray: '2,2', opacity: 0.3 },
      tickCount: 10,
      tickFormat: null,
      postProcess: () => {},
    },
    { afterSet: () => this.tagDirty() },
  )

  constructor(opts: D3PAxisOptions) {
    super(`axis[${opts.name}]`, ['visibilityChanged', 'scaleChanged'], opts.bus)
    this.name = opts.name
    this.domain = opts.domain
    this.pendingOffset = opts.offset ?? 0
    this.position = opts.position ?? 'bottom'
    this.component = this.position === 'left' || this.position === 'right' || this.position === 'radius' ? 'y' : 'x'
    this.systemName = opts.system ?? (this.position === 'angle' || this.position === 'radius' ? 'polar' : 'cartesian')
    this.renderer = opts.renderer ?? d3pDefaultAxisRenderer(this.position)
    this.renderer.bind(this) // throws when the renderer cannot draw this position
    this.scaleType = opts.scaleType ?? 'linear'
    this.scaleOptions = opts.scaleOptions ?? {}
    this.propsHandle.props({ displayName: opts.name })
    if (opts.props) this.propsHandle.props(opts.props)
    this.subs.add(this.bus.on(this.domain.e.domainChanged, (d) => this.onDomainChanged(d)))
    this.subs.add(this.bus.on(this.e.visibilityChanged, (v) => this.applyVisibility(v.target, v.visible)))
  }

  /** The props of the axis: ticks, format, grid, name. */
  get props(): D3PProps<D3PAxisProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the axis. */
  set props(v: DeepPartial<D3PAxisProps>) {
    this.propsHandle.replace(v)
  }

  // ----- attach -----

  /** `offset` overrides the one of the options for this chart. */
  override addToChart(chart: D3PChart, offset?: number): void {
    if (offset !== undefined) this.pendingOffset = offset
    super.addToChart(chart)
  }

  protected createData(chart: D3PChart): AxisChartData {
    const system = chart.coords.resolve(this)
    this.renderer.assertSystem(this, system)
    return { system, scale: this.makeScale(chart, system), visible: true, offset: this.pendingOffset }
  }

  protected attached(chart: D3PChart, data: AxisChartData, subs: D3PSubscriptions): void {
    chart.axes.add(this)
    subs.add(this.bus.on(chart.e.resized, () => this.handleResize(chart)))
    subs.add(this.bus.on(data.system.e.changed, () => this.handleResize(chart)))
    this.renderer.attach?.({ axis: this, chart, system: data.system, subs, redraw: () => this.tagDirty(chart) })
    this.tagDirty(chart)
  }

  protected override detached(chart: D3PChart, data: AxisChartData): void {
    this.renderer.detach?.(chart)
    chart.axes.remove(this)
    data.group?.remove()
    data.gridGroup?.remove()
  }

  private makeScale(chart: D3PChart, system: D3PCoordinateSystem): D3PScale {
    const range = system.ranges(chart)[this.component]
    return d3pScaleFactory(this.scaleType, { ...this.scaleOptions, domain: this.domain.domain, range })
  }

  private handleResize(chart: D3PChart) {
    const data = this.chartData.get(chart)
    if (!data) return
    data.scale = this.makeScale(chart, data.system)
    this.tagDirty(chart)
    this.fire(this.e.scaleChanged, { chart })
  }

  /**
   * The bus is asynchronous, so the scale could lag behind a just-written domain. Scales are
   * therefore re-synchronized with the domain every time they are read.
   */
  private syncScale(data: AxisChartData) {
    const target = this.domain.domain
    const current = (data.scale as any).domain() as D3PDomainValue[]
    const same = current.length === target.length && current.every((v, i) => (typeof v === 'string' ? v === target[i] : +v === +(target[i] as number)))
    if (!same) (data.scale as any).domain(target)
  }

  private onDomainChanged(_domain: D3PDomainValue[]) {
    for (const [chart, data] of this.chartData) {
      this.syncScale(data)
      this.tagDirty(chart)
      this.fire(this.e.scaleChanged, { chart })
    }
  }

  // ----- accessors -----

  /** The scale of the axis on a chart, in line with its domain (`undefined` if the axis is not on it). */
  getScale(chart: D3PChart): D3PScale | undefined {
    const data = this.chartData.get(chart)
    if (!data) return undefined
    this.syncScale(data)
    return data.scale
  }

  // ----- projections -----

  /** The place of a value along this axis, in range units (`undefined` if the scale has none for it). */
  projectTo(chart: D3PChart, value: D3PDomainValue, cache?: D3PProjectionCache): number | undefined {
    return d3pMemo(cache, this, chart, ['to', value], () => {
      const scale = this.getScale(chart)
      return scale ? d3pScaleProjectTo(scale, value) : undefined
    })
  }

  /**
   * The value of this axis under a point of the chart, or `undefined` if there is none (`strict` refuses the points outside of the plot).
   */
  projectFrom(point: D3PViewportPoint, options: { strict?: boolean } = {}, cache?: D3PProjectionCache): D3PDomainValue | undefined {
    const strict = options.strict ?? true
    return d3pMemo(cache, this, point.chart, ['from', point.x, point.y, strict], () => {
      const system = this.getSystem(point.chart)
      const scale = this.getScale(point.chart)
      if (!system || !scale) return undefined
      const u = system.projectFrom(point, { strict }, cache)
      return u ? d3pScaleProjectFrom(scale, u[this.component === 'x' ? 0 : 1]) : undefined
    })
  }

  /** The axis as it is now on `chart` (see {@link D3PAxisSnapshot}); `system` is the snapshot of its system. */
  snapshot(chart: D3PChart, system: D3PSystemSnapshot): D3PAxisSnapshot {
    return new D3PAxisSnapshot(this, chart, system)
  }

  /**
   * How far the axis reaches from its line, outward: the ticks and their labels, in pixels.
   * `undefined` before it is drawn, or where nothing is laid out. A title that sits against the axis
   * uses it.
   */
  getExtent(chart: D3PChart): number | undefined {
    const node = this.chartData.get(chart)?.group?.node()
    if (!node || typeof node.getBBox !== 'function') return undefined
    let box: DOMRect
    try {
      box = node.getBBox()
    } catch {
      return undefined // not rendered
    }
    if (!box.width && !box.height) return undefined
    switch (this.position) {
      case 'left':
        return Math.max(0, -box.x)
      case 'right':
        return Math.max(0, box.x + box.width)
      case 'top':
        return Math.max(0, -box.y)
      case 'bottom':
        return Math.max(0, box.y + box.height)
      default:
        return undefined
    }
  }

  /** Coordinate system of the axis on `chart`. */
  getSystem(chart: D3PChart): D3PCoordinateSystem | undefined {
    return this.chartData.get(chart)?.system
  }

  /** The domain the axis reads. */
  getAxisDomain(): D3PAxisDomain {
    return this.domain
  }

  /**
   * The function that writes a value of this axis: `props.tickFormat`, or the default format of its scale.
   */
  getTickFormatter(chart: D3PChart): (v: any) => string {
    const scale = this.getScale(chart)
    if (!scale) return String
    return this.props.tickFormat ?? d3pDefaultFormatter(scale)
  }

  /** Translation of a side axis inside the chart's inner coordinates (nothing for polar axes). */
  getTranslation(chart: D3PChart): { x: number; y: number } {
    const offset = this.chartData.get(chart)?.offset ?? 0
    return this.renderer instanceof D3PCartesianAxisRenderer ? this.renderer.translation(this, chart, offset) : { x: 0, y: 0 }
  }

  /** Move the axis away from the plot (see the `offset` option), to stack several axes on one side. */
  setOffset(chart: D3PChart, px: number): void {
    const data = this.chartData.get(chart)
    if (!data) return
    data.offset = px
    this.tagDirty(chart)
  }

  /** How far the axis is from the plot, outward, in pixels: what stacks several axes on a side. */
  getOffset(chart: D3PChart): number {
    return this.chartData.get(chart)?.offset ?? 0
  }

  /** Show/hide on one chart, or on all of them. */
  setVisible(visible: boolean, chart?: D3PChart): void {
    for (const c of chart ? [chart] : this.getCharts()) {
      const data = this.chartData.get(c)
      if (!data) continue
      data.visible = visible
      this.fire(this.e.visibilityChanged, { target: c, visible })
    }
  }

  /** Whether the axis is drawn on this chart. */
  isVisible(chart: D3PChart): boolean {
    return this.chartData.get(chart)?.visible ?? false
  }

  private applyVisibility(chart: D3PChart | undefined, _visible: boolean) {
    for (const c of chart ? [chart] : this.getCharts()) {
      const data = this.chartData.get(c)
      if (!data) continue
      const display = data.visible ? 'block' : 'none'
      data.group?.style('display', display)
      data.gridGroup?.style('display', display)
    }
  }

  // ----- draw -----

  override render(chart: D3PChart): void {
    if (this.isDestroying) return
    const data = this.chartData.get(chart)
    if (!data) return
    const cls = this.component
    const props = this.props
    const layer = chart.layer.axis

    if (props.grid.enabled && !data.gridGroup) {
      data.gridGroup = layer
        .append('g')
        .attr('class', `${cls}-grid ${cls}-grid-${this.name}`)
        .attr('fill', 'none')
        .style('pointer-events', 'none')
    } else if (!props.grid.enabled && data.gridGroup) {
      data.gridGroup.remove()
      data.gridGroup = undefined
    }
    if (!data.group) data.group = layer.append('g').attr('class', `${cls}-axis ${cls}-axis-${this.name}`)

    this.syncScale(data)
    const display = data.visible ? 'block' : 'none'
    data.group.style('display', display)
    data.gridGroup?.style('display', display)

    this.renderer.draw({ axis: this, chart, system: data.system, scale: data.scale, group: data.group, gridGroup: data.gridGroup, offset: data.offset, props })
    props.postProcess(data.group as Sel)
  }
}

/** Angle axis of a polar system: `new D3PAxis({ position: 'angle', ... })`. */
export class D3PAngleAxis extends D3PAxis {
  constructor(opts: Omit<D3PAxisOptions, 'position'>) {
    super({ ...opts, position: 'angle' })
  }
}

/** Radius (magnitude) axis of a polar system: `new D3PAxis({ position: 'radius', ... })`. */
export class D3PRadiusAxis extends D3PAxis {
  constructor(opts: Omit<D3PAxisOptions, 'position'>) {
    super({ ...opts, position: 'radius' })
  }
}
