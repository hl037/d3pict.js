import * as d3 from 'd3'
import type { D3PBus } from './bus'
import type { D3PAxis } from './axis'
import type { D3PChart } from './chart'
import { D3PAttachable, D3PObject } from './object'
import { d3pMemo, D3PViewportPoint, type D3PProjectionCache } from './projection'
import { createProps, type D3PProps, type DeepPartial } from './props'
import { d3pServiceKey } from './services'
import { d3pCurveFactory, type D3PCurve, type D3PDomainValue } from './util'

/**
 * Coordinate systems.
 *
 * A *system* is a coordinate system: it gives meaning to the pixels of the chart's inner area.
 * An axis owns a domain and a scale whose range is expressed in the *range units* of its
 * system (cartesian: pixels; polar: radians for the angle and pixels for the radius). The
 * system turns a pair of range-unit values into a viewport point (`projectTo`) and back
 * (`projectFrom`). Everything else (renderers, tools, tooltip, cursor) works on range
 * units and asks the system for the geometry, so a chart can be switched from cartesian to
 * polar by changing the axes only.
 *
 * Systems all share the chart's inner area (no layout): a pointer position that is outside of
 * a system simply has no value in it.
 */

/** A point in range units: `[a, b]`, and for areas a third component, the base `b0` of that point. */
export type D3PRangePoint = [number, number, ...number[]]
/** The two dimensions of a coordinate system: `x` (the angle in polar) and `y` (the radius). */
export type D3PDimension = 'x' | 'y'

/**
 * The range of each dimension of a system: pixels in cartesian, radians and distance from the center in polar.
 */
export interface D3PSystemRanges {
  /** The range of the X dimension (the angle in polar). */
  x: [number, number]
  /** The range of the Y dimension (the radius in polar). */
  y: [number, number]
}

/** The shape of the cursor of a coordinate system: a line, a circle or a path. */
export type D3PCursorGeometry =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: string }

/** Where the label of the cursor goes on an axis: a point, and how the box sits on it. */
export interface D3PLabelAnchor {
  /** Where the box is placed: x, in pixels. */
  x: number
  /** Where the box is placed: y, in pixels. */
  y: number
  /** `x`: the box hangs under (or above) the point; `y`: it sits on its side. */
  kind: 'x' | 'y'
  /**
   * Whether the box goes on the other side (above rather than under the axis, left rather than right).
   */
  flip: boolean
}

/** A cell between two values of each dimension, as an SVG element: a rectangle or a path. */
export type D3PCellShape = { tag: 'rect'; x: number; y: number; width: number; height: number } | { tag: 'path'; d: string; transform?: string }

/** The outline of a zone selected in a system: a path and a transform. */
export interface D3PSelectionShape {
  /** The path of the shape. */
  d: string
  /** An SVG transform to apply to the path, if it needs one. */
  transform?: string
}

/** Options of a coordinate system: its name, and the bus. */
export interface D3PCoordinateSystemOptions {
  /** The bus the system uses (the global bus by default). */
  bus?: D3PBus
  /** Identifier on the chart; axes refer to it with their `system` option. */
  name?: string
}

/** Projections of a system, live (`D3PCoordinateSystem`) or frozen (`D3PSystemSnapshot`). */
export interface D3PSystemProjector {
  /** Ranges of the scales of the first (`x`) and second (`y`) dimension. */
  ranges(chart: D3PChart): D3PSystemRanges
  /** Range units to a viewport point. */
  projectTo(chart: D3PChart, a: number, b: number, cache?: D3PProjectionCache): D3PViewportPoint
  /**
   * Viewport point to range units. `strict` (default) returns `undefined` outside of the
   * system; tools pass `strict: false` to keep following a drag that left it.
   */
  projectFrom(point: D3PViewportPoint, options?: { strict?: boolean }, cache?: D3PProjectionCache): D3PRangePoint | undefined
  /** Normalize a difference along a dimension (an angle wraps around). */
  wrap(chart: D3PChart, dim: D3PDimension, delta: number): number
}

/** A system as it was when `snapshot` was called: later changes of the chart do not reach it. */
export class D3PSystemSnapshot<F = unknown> implements D3PSystemProjector {
  constructor(
    /** The system the snapshot was taken of. */
    readonly system: D3PCoordinateSystem<F>,
    /** The chart the snapshot was taken on. */
    readonly chart: D3PChart,
    /** @internal */ readonly frame: F,
  ) {}

  private check(chart: D3PChart) {
    if (chart !== this.chart) throw new Error(`[d3pict] a snapshot of chart "${this.chart.name}" cannot project on chart "${chart.name}"`)
  }

  ranges(chart: D3PChart): D3PSystemRanges {
    this.check(chart)
    return this.system.rangesIn(this.frame)
  }
  projectTo(chart: D3PChart, a: number, b: number, cache?: D3PProjectionCache): D3PViewportPoint {
    this.check(chart)
    return d3pMemo(cache, this, chart, ['to', a, b], () => {
      const [x, y] = this.system.toPixel(this.frame, a, b)
      return new D3PViewportPoint(chart, x, y)
    })
  }
  projectFrom(point: D3PViewportPoint, options: { strict?: boolean } = {}, cache?: D3PProjectionCache): D3PRangePoint | undefined {
    this.check(point.chart)
    const strict = options.strict ?? true
    return d3pMemo(cache, this, point.chart, ['from', point.x, point.y, strict], () => this.system.fromPixel(this.frame, point.x, point.y, strict))
  }
  wrap(chart: D3PChart, dim: D3PDimension, delta: number): number {
    this.check(chart)
    return this.system.wrapIn(this.frame, dim, delta)
  }
}

/**
 * Turns positions along the axes (range units) into places on the chart and back: it knows the shape of the plot, how to
 * place points and cells, where the cursor goes and what is inside. The cartesian and the polar systems are made from it.
 *
 * @typeParam F the *frame* of the system: the immutable state its projections depend on (the
 *   size of the chart, its props...). Live projections read a fresh frame, snapshots keep one.
 */
export abstract class D3PCoordinateSystem<F = any> extends D3PAttachable<{}, { changed: void }> implements D3PSystemProjector {
  /** The name of the system. Axes and renderers refer to it with their `system` option. */
  readonly name: string

  /**
   * @param kind family of the system (`cartesian`, `polar`...): renderers and axis renderers
   *   declare which kinds they support.
   */
  constructor(readonly kind: string, name: string, bus?: D3PBus) {
    super(`coordinateSystem[${name}]`, ['changed'], bus)
    this.name = name
  }

  protected createData(): {} {
    return {}
  }
  protected attached(chart: D3PChart): void {
    chart.coords.add(this)
  }
  protected override detached(chart: D3PChart): void {
    chart.coords.remove(this)
  }

  /** Announce that the geometry changed (axes rebuild their scales). */
  protected changed() {
    this.fire(this.e.changed)
  }

  // ----- frame: what projections depend on -----

  /** @internal Current frame of the system on `chart`. */
  abstract frameOf(chart: D3PChart): F
  /** @internal */
  abstract rangesIn(frame: F): D3PSystemRanges
  /** @internal Range units to pixels. */
  abstract toPixel(frame: F, a: number, b: number): [number, number]
  /** @internal Pixels to range units; `undefined` outside of the system when `strict`. */
  abstract fromPixel(frame: F, x: number, y: number, strict: boolean): D3PRangePoint | undefined
  /** @internal */
  wrapIn(_frame: F, _dim: D3PDimension, delta: number): number {
    return delta
  }

  // ----- projections -----

  ranges(chart: D3PChart): D3PSystemRanges {
    return this.rangesIn(this.frameOf(chart))
  }
  projectTo(chart: D3PChart, a: number, b: number, cache?: D3PProjectionCache): D3PViewportPoint {
    return d3pMemo(cache, this, chart, ['to', a, b], () => {
      const [x, y] = this.toPixel(this.frameOf(chart), a, b)
      return new D3PViewportPoint(chart, x, y)
    })
  }
  projectFrom(point: D3PViewportPoint, options: { strict?: boolean } = {}, cache?: D3PProjectionCache): D3PRangePoint | undefined {
    const strict = options.strict ?? true
    return d3pMemo(cache, this, point.chart, ['from', point.x, point.y, strict], () => this.fromPixel(this.frameOf(point.chart), point.x, point.y, strict))
  }
  wrap(chart: D3PChart, dim: D3PDimension, delta: number): number {
    return this.wrapIn(this.frameOf(chart), dim, delta)
  }
  /** The system as it is now, to compare the state of a gesture's start with the live one. */
  snapshot(chart: D3PChart): D3PSystemSnapshot<F> {
    return new D3PSystemSnapshot(this, chart, this.frameOf(chart))
  }

  /** Extra points so that a polyline in range units draws the right curve once projected. */
  densify(_chart: D3PChart, pts: D3PRangePoint[]): D3PRangePoint[] {
    return pts
  }
  /** Points whose second value is not finite are gaps: the line breaks there. */
  abstract linePath(chart: D3PChart, pts: D3PRangePoint[], curve?: D3PCurve): string | null
  /**
   * Area between the polyline and its base: the third component of each point, or the constant
   * second-dimension value `b0` when a point has none. Gaps break the area.
   */
  abstract areaPath(chart: D3PChart, pts: D3PRangePoint[], b0: number, curve?: D3PCurve): string | null
  /** The cell between `a0`..`a1` and `b0`..`b1` (range units): a rectangle, an arc... */
  abstract cellShape(chart: D3PChart, a0: number, a1: number, b0: number, b1: number): D3PCellShape
  /** Shape of a selection dragged between two points of the inner area. */
  abstract selectionShape(chart: D3PChart, from: [number, number], to: [number, number]): D3PSelectionShape
  /**
   * Where the tooltip box is anchored for a data point `(a, b)`. `pointer` is the pointer position
   * when it is over this chart; `ratioY` its relative height, which other charts reuse.
   */
  abstract tooltipAnchor(chart: D3PChart, a: number, b: number, ratioY: number, pointer?: [number, number]): [number, number]
  /** The shape of the cursor at a position of each dimension: a line, a circle or a path. */
  abstract cursor(chart: D3PChart, a: number | undefined, b: number | undefined): { x?: D3PCursorGeometry; y?: D3PCursorGeometry }
  /** Where the label of the cursor goes for an axis, given a position along each dimension. */
  abstract label(chart: D3PChart, axis: D3PAxis, dim: D3PDimension, a: number | undefined, b: number | undefined): D3PLabelAnchor | undefined
  /** Whether a point in range units is inside the system (points outside are not drawn). */
  inRange(_chart: D3PChart, _a: number, _b: number): boolean {
    return true
  }
  /** `url(#id)` of a clip path limiting what is drawn to the system's shape, if it has one. */
  clipPath(_chart: D3PChart): string | undefined {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Cartesian
// ---------------------------------------------------------------------------

/** The rectangle of the plot: x goes right, y goes up. */
export class D3PCartesianSystem extends D3PCoordinateSystem<{ width: number; height: number }> {
  constructor(opts: D3PCoordinateSystemOptions = {}) {
    super('cartesian', opts.name ?? 'cartesian', opts.bus)
  }

  frameOf(chart: D3PChart) {
    return { width: chart.innerWidth, height: chart.innerHeight }
  }
  rangesIn(frame: { width: number; height: number }): D3PSystemRanges {
    return { x: [0, frame.width], y: [frame.height, 0] }
  }
  toPixel(_frame: { width: number; height: number }, a: number, b: number): [number, number] {
    return [a, b]
  }
  fromPixel(_frame: { width: number; height: number }, x: number, y: number): D3PRangePoint {
    return [x, y]
  }
  linePath(_chart: D3PChart, pts: D3PRangePoint[], curve?: D3PCurve): string | null {
    return d3.line<D3PRangePoint>().defined((p) => Number.isFinite(p[1])).curve(d3pCurveFactory(curve))(pts)
  }
  areaPath(_chart: D3PChart, pts: D3PRangePoint[], b0: number, curve?: D3PCurve): string | null {
    return d3
      .area<D3PRangePoint>()
      .defined((p) => Number.isFinite(p[1]) && Number.isFinite(p[2] ?? b0))
      .x((p) => p[0])
      .y0((p) => p[2] ?? b0)
      .y1((p) => p[1])
      .curve(d3pCurveFactory(curve))(pts)
  }
  selectionShape(_chart: D3PChart, from: [number, number], to: [number, number]): D3PSelectionShape {
    return { d: rectPath(from, to) }
  }
  cellShape(_chart: D3PChart, a0: number, a1: number, b0: number, b1: number): D3PCellShape {
    return { tag: 'rect', x: Math.min(a0, a1), y: Math.min(b0, b1), width: Math.abs(a1 - a0), height: Math.abs(b1 - b0) }
  }
  tooltipAnchor(chart: D3PChart, a: number, _b: number, ratioY: number): [number, number] {
    return [a, ratioY * chart.innerHeight]
  }
  /** A vertical line at `a` and a horizontal line at `b`. */
  cursor(chart: D3PChart, a: number | undefined, b: number | undefined) {
    return {
      x: a === undefined ? undefined : ({ kind: 'line', x1: a, x2: a, y1: 0, y2: chart.innerHeight } as const),
      y: b === undefined ? undefined : ({ kind: 'line', y1: b, y2: b, x1: 0, x2: chart.innerWidth } as const),
    }
  }
  /**
   * The label of the cursor for an axis: it hangs under (or above) an X axis, and sits beside a Y axis.
   */
  label(chart: D3PChart, axis: D3PAxis, dim: D3PDimension, a: number | undefined, b: number | undefined): D3PLabelAnchor | undefined {
    const t = axis.getTranslation(chart)
    if (dim === 'x') return a === undefined ? undefined : { x: a, y: t.y, kind: 'x', flip: axis.position === 'top' }
    return b === undefined ? undefined : { x: t.x, y: b, kind: 'y', flip: axis.position === 'left' }
  }
}

/** Rectangle path between two corners (also the selection shape when no system is known). */
export function rectPath(from: [number, number], to: [number, number]): string {
  const x = Math.min(from[0], to[0])
  const y = Math.min(from[1], to[1])
  return `M${x},${y}h${Math.abs(to[0] - from[0])}v${Math.abs(to[1] - from[1])}h${-Math.abs(to[0] - from[0])}Z`
}

// ---------------------------------------------------------------------------
// Polar
// ---------------------------------------------------------------------------

/**
 * Props of a polar system: where the angle starts and which way it goes, the hole, the part of the circle covered, the shift of the center, the padding and the reach of the pointer.
 */
export interface D3PPolarProps {
  /** Screen angle (degrees) at which the angle range starts: 0 = up. */
  startAngle: number
  /** Whether the angle grows clockwise (default true). */
  clockwise: boolean
  /** Hole radius as a fraction of the outer radius (0 = full disc, 0.5 = ring). */
  innerRadius: number
  /** Angle covered by the system, in degrees: 360 is a full circle, 180 a half (gauges, semi-donuts). */
  sweep: number
  /** Moves the center, as fractions of the outer radius: `[0, 0.5]` lowers a half disc so that it sits in the middle. */
  shift: [number, number]
  /** Pixels kept free around the disc, for the angle labels. */
  padding: number
  /**
   * How far beyond the ring, in pixels, the pointer still counts as being over the system. There
   * it reads the angle and the outer radius, so the tooltip, the markers and the radius axis that
   * follows the pointer keep working around the chart, not only on the disc.
   */
  reach: number
}

/** Options of a polar system: its name and its props. */
export interface D3PPolarOptions extends D3PCoordinateSystemOptions {
  /** Initial props of the system. */
  props?: DeepPartial<D3PPolarProps>
}

/**
 * The geometry of a polar system on a chart: center, radii, angle and the reach of the pointer, in pixels and radians.
 */
export interface D3PPolarGeometry {
  /** X of the center, in pixels. */
  cx: number
  /** Y of the center, in pixels. */
  cy: number
  /** Outer / inner radius in pixels. */
  R: number
  /** Radius of the hole, in pixels (0 for a full disc). */
  r0: number
  /** Start angle in radians and direction (1 clockwise, -1 counter-clockwise). */
  a0: number
  /** Direction of the angle: 1 clockwise, -1 counter-clockwise. */
  dir: 1 | -1
  /** Angle covered, in radians (a full turn is 2 pi). */
  sweep: number
  /** Pixels beyond the outer radius that still count as over the system. */
  reach: number
}

const TAU = Math.PI * 2
/** Largest angular step of a drawn polyline (radians): curves stay round between sparse points. */
const MAX_STEP = Math.PI / 90
const EPS = 1e-9

/**
 * Polar system: the first dimension is the angle (radians on screen, 0 = up, clockwise by
 * default), the second the distance to the center. The disc is centered in the inner area.
 */
export class D3PPolarSystem extends D3PCoordinateSystem<D3PPolarGeometry> {
  private readonly propsHandle = createProps<D3PPolarProps>(
    { startAngle: 0, clockwise: true, innerRadius: 0, sweep: 360, shift: [0, 0], padding: 28, reach: 112 },
    { afterSet: () => this.changed() },
  )

  constructor(opts: D3PPolarOptions = {}) {
    super('polar', opts.name ?? 'polar', opts.bus)
    if (opts.props) this.propsHandle.props(opts.props)
  }

  /** The props of the system: where the angle starts, the hole, the padding... */
  get props(): D3PProps<D3PPolarProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the system; the chart is drawn again. */
  set props(v: DeepPartial<D3PPolarProps>) {
    this.propsHandle.replace(v)
  }

  frameOf(chart: D3PChart): D3PPolarGeometry {
    return this.geometry(chart)
  }

  /**
   * The geometry of the system on a chart: the center and the radii in pixels, the angle range and the reach of the pointer.
   */
  geometry(chart: D3PChart): D3PPolarGeometry {
    const { startAngle, clockwise, innerRadius, sweep, shift, padding, reach } = this.props
    const R = Math.max(0, Math.min(chart.innerWidth, chart.innerHeight) / 2 - padding)
    return {
      cx: chart.innerWidth / 2 + shift[0] * R,
      cy: chart.innerHeight / 2 + shift[1] * R,
      R,
      r0: R * Math.min(Math.max(innerRadius, 0), 0.99),
      a0: (startAngle * Math.PI) / 180,
      dir: clockwise ? 1 : -1,
      sweep: (Math.min(Math.max(sweep, 1), 360) * Math.PI) / 180,
      reach: Math.max(0, reach),
    }
  }

  rangesIn(g: D3PPolarGeometry): D3PSystemRanges {
    return { x: [g.a0, g.a0 + g.dir * g.sweep], y: [g.r0, g.R] }
  }

  toPixel(g: D3PPolarGeometry, a: number, b: number): [number, number] {
    // below the inner radius (a zoomed radius axis, a value under its domain) a point stays on the inner circle: a negative distance would put it on the other side of the center
    const r = Math.max(b, g.r0)
    return [g.cx + r * Math.sin(a), g.cy - r * Math.cos(a)]
  }

  /** Range units to pixels, as a plain pair (drawing). */
  private pixel(chart: D3PChart, a: number, b: number): [number, number] {
    return this.toPixel(this.geometry(chart), a, b)
  }

  fromPixel(g: D3PPolarGeometry, x: number, y: number, strict: boolean): D3PRangePoint | undefined {
    const dx = x - g.cx
    const dy = y - g.cy
    const r = Math.hypot(dx, dy)
    // just beyond the ring the pointer still reads the angle, and the outer radius
    if (strict && (g.R <= 0 || r > g.R + g.reach || r < g.r0)) return undefined
    const rel = mod(g.dir * (Math.atan2(dx, -dy) - g.a0), TAU)
    if (strict && rel > g.sweep + EPS && g.sweep < TAU - EPS) return undefined // in the part of the circle the system does not cover
    return [g.a0 + g.dir * rel, strict ? Math.min(r, g.R) : r]
  }

  override densify(_chart: D3PChart, pts: D3PRangePoint[]): D3PRangePoint[] {
    const out: D3PRangePoint[] = []
    pts.forEach((p, i) => {
      if (i > 0) {
        const q = pts[i - 1]
        const n = Math.min(360, Math.ceil(Math.abs(p[0] - q[0]) / MAX_STEP))
        for (let k = 1; k < n; k++) out.push(p.map((v, c) => (q[c] ?? v) + ((v - (q[c] ?? v)) * k) / n) as D3PRangePoint)
      }
      out.push(p)
    })
    return out
  }

  private projectAll(chart: D3PChart, pts: D3PRangePoint[], straight = false) {
    return (straight ? pts : this.densify(chart, pts)).map((p) => this.pixel(chart, p[0], p[1]))
  }

  /** Pieces of the polyline without gaps. */
  private defined(pts: D3PRangePoint[], b0?: number): D3PRangePoint[][] {
    const runs: D3PRangePoint[][] = []
    let cur: D3PRangePoint[] = []
    for (const p of pts) {
      if (Number.isFinite(p[1]) && Number.isFinite(p[2] ?? b0 ?? 0)) cur.push(p)
      else if (cur.length) (runs.push(cur), (cur = []))
    }
    if (cur.length) runs.push(cur)
    return runs
  }

  /**
   * The polyline cut to the angle range: the part outside of it has no value, instead of
   * wrapping around onto the circle. Each run is a continuous piece inside the range.
   */
  private runs(chart: D3PChart, pts: D3PRangePoint[]): D3PRangePoint[][] {
    const [a, b] = this.ranges(chart).x
    const lo = Math.min(a, b) - EPS
    const hi = Math.max(a, b) + EPS
    const inside = (v: number) => v >= lo && v <= hi
    const cut = (q: D3PRangePoint, p: D3PRangePoint, at: number): D3PRangePoint => {
      const k = (at - q[0]) / (p[0] - q[0])
      return p.map((v, c) => (c === 0 ? at : (q[c] ?? v) + (v - (q[c] ?? v)) * k)) as D3PRangePoint
    }
    const runs: D3PRangePoint[][] = []
    let cur: D3PRangePoint[] = []
    pts.forEach((p, i) => {
      if (i === 0) {
        if (inside(p[0])) cur.push(p)
        return
      }
      const q = pts[i - 1]
      const qIn = inside(q[0])
      const pIn = inside(p[0])
      if (qIn && pIn) cur.push(p)
      else if (qIn) {
        cur.push(cut(q, p, p[0] > hi ? hi : lo))
        runs.push(cur)
        cur = []
      } else if (pIn) cur = [cut(q, p, q[0] > hi ? hi : lo), p]
      else if ((q[0] < lo && p[0] > hi) || (q[0] > hi && p[0] < lo)) {
        // a segment that crosses the whole range
        runs.push(q[0] < p[0] ? [cut(q, p, lo), cut(q, p, hi)] : [cut(q, p, hi), cut(q, p, lo)])
      }
    })
    if (cur.length) runs.push(cur)
    return runs
  }

  linePath(chart: D3PChart, pts: D3PRangePoint[], curve?: D3PCurve): string | null {
    const straight = curve === 'straight'
    const line = d3.line().curve(d3pCurveFactory(curve === 'straight' ? 'linear' : curve))
    const d = this.defined(pts)
      .flatMap((run) => this.runs(chart, run))
      .map((run) => line(this.projectAll(chart, run, straight)))
      .join('')
    return d || null
  }

  areaPath(chart: D3PChart, pts: D3PRangePoint[], b0: number, curve?: D3PCurve): string | null {
    const g = this.geometry(chart)
    const clamp = (b: number) => Math.min(Math.max(b, g.r0), g.R)
    const straight = curve === 'straight'
    const outline = d3.line().curve(d3pCurveFactory(curve === 'straight' ? 'linear' : curve))
    const d = this.defined(pts, b0)
      .flatMap((run) => this.runs(chart, run))
      .map((run) => {
        const base = run.map((p) => [p[0], clamp(p[2] ?? b0)] as D3PRangePoint).reverse()
        // the base is closed with straight pieces: a curve there would not follow the other edge
        const top = outline(this.projectAll(chart, run, straight))
        const bottom = d3.line()(this.projectAll(chart, base, straight)) ?? ''
        return top ? `${top}L${bottom.slice(1)}Z` : ''
      })
      .join('')
    return d || null
  }

  override inRange(chart: D3PChart, a: number, b: number): boolean {
    const g = this.geometry(chart)
    const [x0, x1] = this.ranges(chart).x
    return a >= Math.min(x0, x1) - EPS && a <= Math.max(x0, x1) + EPS && b >= g.r0 - EPS && b <= g.R + EPS
  }

  private readonly clips = new Map<D3PChart, { id: string; clip: d3.Selection<SVGClipPathElement, unknown, null, undefined>; path: d3.Selection<SVGPathElement, unknown, null, undefined> }>()

  /** Ring (disc minus the hole) limiting the drawing, so a zoomed radius never overflows it. */
  override clipPath(chart: D3PChart): string {
    let clip = this.clips.get(chart)
    if (!clip) {
      const id = `polar-clip-${chart.id}-${this.name}-${Math.random().toString(36).slice(2, 8)}`
      const element = chart.defs.append('clipPath').attr('id', id)
      this.clips.set(chart, (clip = { id, clip: element, path: element.append('path').attr('clip-rule', 'evenodd') }))
    }
    const g = this.geometry(chart)
    const circle = (r: number) => `M${g.cx - r},${g.cy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`
    if (g.sweep >= TAU - EPS) clip.path.attr('d', circle(g.R) + (g.r0 > 0 ? circle(g.r0) : '')).attr('transform', null)
    else {
      // a wedge: the ring sector the system covers
      const d = d3.arc()({ innerRadius: g.r0, outerRadius: g.R, startAngle: g.a0, endAngle: g.a0 + g.dir * g.sweep })
      clip.path.attr('d', d ?? '').attr('transform', `translate(${g.cx},${g.cy})`)
    }
    return `url(#${clip.id})`
  }

  protected override detached(chart: D3PChart): void {
    this.clips.get(chart)?.clip.remove()
    this.clips.delete(chart)
    super.detached(chart)
  }

  cellShape(chart: D3PChart, a0: number, a1: number, b0: number, b1: number): D3PCellShape {
    const g = this.geometry(chart)
    const d = d3.arc()({ innerRadius: Math.min(b0, b1), outerRadius: Math.max(b0, b1), startAngle: a0, endAngle: a1 })
    return { tag: 'path', d: d ?? '', transform: `translate(${g.cx},${g.cy})` }
  }

  selectionShape(chart: D3PChart, from: [number, number], to: [number, number]): D3PSelectionShape {
    const g = this.geometry(chart)
    const polar = (p: [number, number]) => ({ a: Math.atan2(p[0] - g.cx, -(p[1] - g.cy)), r: Math.hypot(p[0] - g.cx, p[1] - g.cy) })
    const s = polar(from)
    const e = polar(to)
    const sweep = mod(e.a - s.a + Math.PI, TAU) - Math.PI // shortest way from start to end
    const d = d3.arc()({ innerRadius: Math.min(s.r, e.r), outerRadius: Math.max(s.r, e.r), startAngle: s.a, endAngle: s.a + sweep })
    return { d: d ?? '', transform: `translate(${g.cx},${g.cy})` }
  }

  /** Follows the pointer; on a chart the pointer is not over, falls back to the data point. */
  tooltipAnchor(chart: D3PChart, a: number, b: number, _ratioY: number, pointer?: [number, number]): [number, number] {
    return pointer ?? this.pixel(chart, a, b)
  }

  /** A spoke at the angle `a` and a circle at the radius `b`. */
  cursor(chart: D3PChart, a: number | undefined, b: number | undefined) {
    const g = this.geometry(chart)
    const [x1, y1] = this.pixel(chart, a ?? 0, g.r0)
    const [x2, y2] = this.pixel(chart, a ?? 0, g.R)
    return {
      x: a === undefined ? undefined : ({ kind: 'line', x1, y1, x2, y2 } as const),
      y: b === undefined ? undefined : this.arcGeometry(g, b),
    }
  }

  /** A circle of radius `r`, or the arc of it the system covers. */
  private arcGeometry(g: D3PPolarGeometry, r: number): D3PCursorGeometry {
    if (g.sweep >= TAU - EPS) return { kind: 'circle', cx: g.cx, cy: g.cy, r }
    return { kind: 'path', d: arcPath(g.cx, g.cy, r, g.a0, g.a0 + g.dir * g.sweep) }
  }

  /** The label of the cursor for an axis: against the disc, on its angle axis, and beside the radius. */
  label(chart: D3PChart, _axis: D3PAxis, dim: D3PDimension, a: number | undefined, b: number | undefined): D3PLabelAnchor | undefined {
    const g = this.geometry(chart)
    if (dim === 'x') {
      if (a === undefined) return undefined
      const [x, y] = this.pixel(chart, a, g.R + 14)
      return { x, y, kind: 'x', flip: false }
    }
    if (b === undefined) return undefined
    const [x, y] = this.pixel(chart, a ?? g.a0, b)
    return { x, y, kind: 'y', flip: false }
  }

  override wrapIn(g: D3PPolarGeometry, dim: D3PDimension, delta: number): number {
    // only a full circle wraps around
    return dim === 'x' && g.sweep >= TAU - EPS ? mod(delta + Math.PI, TAU) - Math.PI : delta
  }
}

/** SVG path of the arc of radius `r` around `(cx, cy)` from screen angle `a0` to `a1` (0 = up, clockwise). */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return `M${p(a0)}A${r},${r} 0 ${large},${a1 > a0 ? 1 : 0} ${p(a1)}`
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

// ---------------------------------------------------------------------------
// The per-chart service
// ---------------------------------------------------------------------------

/** Key of the service that holds the coordinate systems of a chart (`chart.coords`). */
export const D3P_COORDS = d3pServiceKey<D3PCoordinates>('coordinates')

/** Converts a joined value from one axis to another (e.g. hours of the day to degrees). */
export type D3PJoinConvert = (value: D3PDomainValue, from: string, to: string) => D3PDomainValue | undefined

/**
 * A set of axes that describe the same quantity, with the conversion between them if the values differ.
 */
export type D3PJoinSpec = ReadonlyArray<D3PAxis | string> | { axes: ReadonlyArray<D3PAxis | string>; convert?: D3PJoinConvert }

/** A group of joined axes (by name), and the conversion between them. */
export interface D3PJoinGroup {
  /** The names of the axes of the group. */
  names: ReadonlySet<string>
  /** Converts a value of one of the joined axes to another's. */
  convert?: D3PJoinConvert
}

/** Normalize a join spec to axis names. */
export function d3pJoinGroup(spec: D3PJoinSpec): D3PJoinGroup {
  const axes = 'axes' in spec ? spec.axes : spec
  const convert = 'axes' in spec ? spec.convert : undefined
  return { names: new Set(axes.map((a) => (typeof a === 'string' ? a : a.name))), convert }
}

/**
 * Per-chart set of coordinate systems and of the *joins* between their axes.
 *
 * A join says that axes of different systems describe the same quantity (a time shown on a
 * cartesian X axis and as the angle of a polar chart, say). The probe (`D3PProbe.projectFrom`)
 * gives the value an axis should look at for a pointer event, even when the pointer is not
 * over its own system: the tooltip and the cursor follow the pointer across systems that way.
 * Axes with the same name, or sharing one domain, are joined implicitly.
 */
export class D3PCoordinates extends D3PObject<{ systemsChanged: D3PCoordinateSystem[] }> {
  private readonly systems = new Map<string, D3PCoordinateSystem>()
  private readonly owned = new Set<D3PCoordinateSystem>()
  private readonly groups: D3PJoinGroup[] = []
  private readonly offs = new Map<D3PCoordinateSystem, () => void>()

  constructor(/** The chart whose systems it holds. */ readonly chart: D3PChart) {
    super(`${chart.name}.coords`, ['systemsChanged'], chart.bus)
    this.subs.add(this.bus.on(chart.e.destroyed, () => this.destroy()))
  }

  /** Adds a coordinate system to the chart. Throws an error if another has its name. */
  add(system: D3PCoordinateSystem): void {
    const existing = this.systems.get(system.name)
    if (existing === system) return
    if (existing) throw new Error(`[d3pict] a coordinate system named "${system.name}" already exists in chart "${this.chart.name}"`)
    this.systems.set(system.name, system)
    this.offs.set(system, this.bus.on(system.e.destroyed, () => this.remove(system)))
    this.announce()
  }

  /** Removes a coordinate system from the chart. */
  remove(system: D3PCoordinateSystem): void {
    if (this.systems.get(system.name) !== system) return
    this.systems.delete(system.name)
    this.offs.get(system)?.()
    this.offs.delete(system)
    this.owned.delete(system)
    this.announce()
  }

  private announce() {
    if (!this.isDestroying) this.fire(this.e.systemsChanged, this.list())
  }

  /** The system of that name, if any. */
  get(name: string): D3PCoordinateSystem | undefined {
    return this.systems.get(name)
  }

  /** The coordinate systems of the chart. */
  list(): D3PCoordinateSystem[] {
    return [...this.systems.values()]
  }

  /**
   * The system called `name`, created with default settings when it is one of the two default
   * systems (`cartesian`, `polar`) and nobody registered it. Throws for an unknown custom name.
   */
  ensure(name: string, who = 'a renderer'): D3PCoordinateSystem {
    const found = this.systems.get(name)
    if (found) return found
    const made = name === 'cartesian' ? new D3PCartesianSystem({ bus: this.bus }) : name === 'polar' ? new D3PPolarSystem({ bus: this.bus }) : undefined
    if (!made) {
      const known = [...this.systems.keys()].join(', ') || 'none'
      throw new Error(`[d3pict] ${who}: unknown coordinate system "${name}" (registered: ${known}). Add it to the chart first.`)
    }
    this.owned.add(made)
    made.addToChart(this.chart)
    return made
  }

  /** The system of `axis` (see `ensure`). */
  resolve(axis: D3PAxis): D3PCoordinateSystem {
    return this.ensure(axis.systemName, `axis "${axis.name}"`)
  }

  // ----- joins -----

  /** Declare that these axes (objects or names) describe the same quantity. Returns an undo function. */
  join(spec: D3PJoinSpec): () => void {
    const group = d3pJoinGroup(spec)
    this.groups.push(group)
    return () => {
      const i = this.groups.indexOf(group)
      if (i >= 0) this.groups.splice(i, 1)
    }
  }

  /** The groups of axes that describe the same quantity, declared on this chart. */
  getJoins(): readonly D3PJoinGroup[] {
    return this.groups
  }

  protected override onDestroy(): void {
    for (const off of this.offs.values()) off()
    this.offs.clear()
    for (const s of [...this.owned]) s.destroy()
    this.owned.clear()
    this.systems.clear()
    this.groups.length = 0
  }
}
