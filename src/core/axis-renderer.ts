import * as d3 from 'd3'
import type { D3PSubscriptions } from './bus'
import type { D3PAxis, D3PAxisPosition, D3PAxisProps } from './axis'
import type { D3PChart } from './chart'
import { arcPath, type D3PCoordinateSystem, type D3PPolarGeometry, type D3PPolarSystem } from './coords'
import { d3pRequireInteractionArea } from './interaction'
import type { D3PProps } from './props'
import { d3pScaleProjectTo, type D3PScale } from './util'

type Sel = d3.Selection<SVGGElement, unknown, null, undefined>

/**
 * What an axis renderer is given to draw: the axis, the chart, the system, the scale, the group to draw in, the grid group, the offset and the props.
 */
export interface D3PAxisDrawContext {
  /** The axis to draw. */
  readonly axis: D3PAxis
  /** The chart it is drawn on. */
  readonly chart: D3PChart
  /** The coordinate system of the axis. */
  readonly system: D3PCoordinateSystem
  /** Scale of the axis on this chart (synchronized with its domain). */
  readonly scale: D3PScale
  /** The group to draw the axis in. */
  readonly group: Sel
  /** Present when the grid is enabled in the axis props. */
  readonly gridGroup: Sel | undefined
  /** Distance from the plot, outward (see the axis' `offset` option): cartesian axes stacked on one side. */
  readonly offset: number
  /** The props of the axis: ticks, format, grid. */
  readonly props: D3PProps<D3PAxisProps>
}

/**
 * What an axis renderer is given when its axis joins a chart: the axis, the chart, the system, the subscriptions to release, and a function that asks for a redraw.
 */
export interface D3PAxisAttachContext {
  /** The axis that joins the chart. */
  readonly axis: D3PAxis
  /** The chart it joined. */
  readonly chart: D3PChart
  /** The coordinate system of the axis. */
  readonly system: D3PCoordinateSystem
  /** Released when the axis leaves the chart. */
  readonly subs: D3PSubscriptions
  /** Ask for a redraw of the axis on this chart (batched with the others). */
  readonly redraw: () => void
}

/**
 * Draws an axis. The axis keeps the domain and the scale; its renderer decides how they look:
 * on a side of the chart, as a ring, along a spoke that follows the pointer...
 *
 * A renderer declares the axis positions and the kinds of coordinate system it supports; the
 * axis refuses it with an explicit error otherwise. One renderer instance serves one axis.
 */
export abstract class D3PAxisRenderer {
  /** The name of the renderer, for error messages. */
  abstract readonly name: string
  /** The positions of axes the renderer can draw. */
  abstract readonly positions: readonly D3PAxisPosition[]
  /** The kinds of coordinate system the renderer can draw in (`cartesian`, `polar`). */
  abstract readonly systemKinds: readonly string[]
  private bound: D3PAxis | undefined

  /** Called by the axis when it is built with this renderer. */
  bind(axis: D3PAxis): void {
    if (this.bound && this.bound !== axis) {
      throw new Error(`[d3pict] the axis renderer ${this.name} is already used by axis "${this.bound.name}"; give each axis its own instance`)
    }
    if (!this.positions.includes(axis.position)) {
      throw new Error(
        `[d3pict] axis "${axis.name}" (position "${axis.position}") is not supported by the axis renderer ${this.name}; it supports: ${this.positions.join(', ')}`,
      )
    }
    this.bound = axis
  }

  /** Checks the coordinate system the axis ended up in. */
  assertSystem(axis: D3PAxis, system: D3PCoordinateSystem): void {
    if (!this.systemKinds.includes(system.kind)) {
      throw new Error(
        `[d3pict] axis "${axis.name}" is on the ${system.kind} system "${system.name}", which the axis renderer ${this.name} does not support (it needs: ${this.systemKinds.join(', ')})`,
      )
    }
  }

  /** Called when the axis joins a chart: subscribe to what the drawing depends on, and use `redraw`. */
  attach?(ctx: D3PAxisAttachContext): void
  /** Called when the axis leaves a chart: release what `attach` took. */
  detach?(chart: D3PChart): void
  /** Draws the axis: its line, its ticks, its labels, and its grid when `ctx.gridGroup` is given. */
  abstract draw(ctx: D3PAxisDrawContext): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function styleGrid(grid: Sel, props: D3PProps<D3PAxisProps>) {
  const g = props.grid
  grid.selectAll('line, circle, path, polygon').attr('stroke', g.stroke).attr('stroke-width', g.strokeWidth).attr('stroke-dasharray', g.strokeDasharray).attr('opacity', g.opacity).attr('fill', 'none')
}

/** Tick values to show: continuous scales choose them, band/point scales list their categories. */
function tickValues(scale: D3PScale, count: number): unknown[] {
  const s = scale as any
  return typeof s.ticks === 'function' ? s.ticks(count) : s.domain()
}

function formatter(ctx: D3PAxisDrawContext): (v: any) => string {
  return ctx.axis.getTickFormatter(ctx.chart)
}

function textAnchor(dx: number): string {
  return dx > 0.3 ? 'start' : dx < -0.3 ? 'end' : 'middle'
}
function baseline(dy: number): string {
  return dy > 0.3 ? 'hanging' : dy < -0.3 ? 'auto' : 'central'
}

// ---------------------------------------------------------------------------
// Cartesian: the axis sits on one side of the chart
// ---------------------------------------------------------------------------

/**
 * A straight axis along a side of the plot, with its ticks, its labels and its grid. It draws the axes `bottom`, `top`, `left` and `right` of a cartesian system.
 */
export class D3PCartesianAxisRenderer extends D3PAxisRenderer {
  readonly name = 'D3PCartesianAxisRenderer'
  readonly positions = ['bottom', 'top', 'left', 'right'] as const
  readonly systemKinds = ['cartesian'] as const

  /** Translation of the axis group inside the inner area. */
  translation(axis: D3PAxis, chart: D3PChart, offset: number): { x: number; y: number } {
    return axis.component === 'x'
      ? { x: 0, y: axis.position === 'bottom' ? chart.innerHeight + offset : -offset }
      : { x: axis.position === 'left' ? -offset : chart.innerWidth + offset, y: 0 }
  }

  /** Draws a straight axis along a side of the plot, with its ticks, its labels and its grid. */
  draw(ctx: D3PAxisDrawContext): void {
    const { axis, chart, scale, group, gridGroup, props } = ctx
    const { x, y } = this.translation(axis, chart, ctx.offset)
    const transform = `translate(${x},${y})`
    group.attr('transform', transform)
    gridGroup?.attr('transform', transform)

    const make = { bottom: d3.axisBottom, top: d3.axisTop, left: d3.axisLeft, right: d3.axisRight }[axis.position as 'bottom']
    group.call(make(scale as any).ticks(props.tickCount).tickFormat(props.tickFormat as any))

    if (gridGroup) {
      // Only the tick length matters for the grid, so the orientation of the generator is irrelevant.
      const grid = axis.component === 'x' ? d3.axisBottom(scale as any).tickSize(-chart.innerHeight) : d3.axisLeft(scale as any).tickSize(-chart.innerWidth)
      gridGroup.call(grid.ticks(props.tickCount).tickFormat(() => ''))
      styleGrid(gridGroup, props)
      gridGroup.select('.domain').remove()
    }
  }
}

// ---------------------------------------------------------------------------
// Polar
// ---------------------------------------------------------------------------

function polarOf(ctx: D3PAxisDrawContext): D3PPolarSystem {
  return ctx.system as D3PPolarSystem
}

/** The angle axis: a ring at the outer radius, with a tick (and a spoke of grid) per value. */
export class D3PAngleAxisRenderer extends D3PAxisRenderer {
  /** The name of the renderer. */
  readonly name: string = 'D3PAngleAxisRenderer'
  readonly positions = ['angle'] as const
  readonly systemKinds = ['polar'] as const

  /** The line at the outer radius: a circle, or the arc the system covers (a polygon for a radar). */
  protected drawRing(group: Sel, g: D3PPolarGeometry, _angles: number[]) {
    const full = g.sweep >= Math.PI * 2 - 1e-9
    if (full) group.append('circle').attr('class', 'domain').attr('cx', g.cx).attr('cy', g.cy).attr('r', g.R).attr('fill', 'none').attr('stroke', 'currentColor')
    else group.append('path').attr('class', 'domain').attr('d', arcPath(g.cx, g.cy, g.R, g.a0, g.a0 + g.dir * g.sweep)).attr('fill', 'none').attr('stroke', 'currentColor')
  }

  /**
   * Draws the angle axis: a ring with a tick and a label for each value, and a spoke for each grid line.
   */
  draw(ctx: D3PAxisDrawContext): void {
    const { chart, scale, group, gridGroup, props } = ctx
    const sys = polarOf(ctx)
    const g = sys.geometry(chart)
    const fmt = formatter(ctx)
    group.attr('transform', null).selectAll('*').remove()
    gridGroup?.attr('transform', null).selectAll('*').remove()

    let values = tickValues(scale, props.tickCount)
    // a full-circle domain would draw its first value twice (at 0 and at 360)
    if (values.length > 1 && g.sweep >= Math.PI * 2 - 1e-9) {
      const first = d3pScaleProjectTo(scale, values[0] as any)
      const last = d3pScaleProjectTo(scale, values[values.length - 1] as any)
      if (first !== undefined && last !== undefined && Math.abs(Math.abs(last - first) - Math.PI * 2) < 1e-6) values = values.slice(0, -1)
    }

    const placed = values.map((v) => ({ v, a: d3pScaleProjectTo(scale, v as any) })).filter((e): e is { v: unknown; a: number } => e.a !== undefined)
    const angles = placed.map((e) => e.a)
    this.drawRing(group, g, angles)

    for (const { v, a } of placed) {
      const dx = Math.sin(a)
      const dy = -Math.cos(a)
      const tick = group.append('g').attr('class', 'tick')
      tick.append('line').attr('stroke', 'currentColor').attr('x1', g.cx + dx * g.R).attr('y1', g.cy + dy * g.R).attr('x2', g.cx + dx * (g.R + 6)).attr('y2', g.cy + dy * (g.R + 6))
      tick
        .append('text')
        .attr('fill', 'currentColor')
        .attr('font-size', 10)
        .attr('x', g.cx + dx * (g.R + 10))
        .attr('y', g.cy + dy * (g.R + 10))
        .attr('text-anchor', textAnchor(dx))
        .attr('dominant-baseline', baseline(dy))
        .text(fmt(v))
      gridGroup?.append('line').attr('x1', g.cx + dx * g.r0).attr('y1', g.cy + dy * g.r0).attr('x2', g.cx + dx * g.R).attr('y2', g.cy + dy * g.R)
    }
    if (gridGroup) {
      this.drawRings(ctx, g, angles, gridGroup)
      styleGrid(gridGroup, props)
    }
  }

  /** Extra grid drawn with the spokes (a radar's polygons); the radius axis draws the circles. */
  protected drawRings(_ctx: D3PAxisDrawContext, _g: D3PPolarGeometry, _angles: number[], _grid: Sel): void {}
}

/**
 * The angle axis of a radar chart: categories on a band scale, a polygon instead of the outer
 * circle, and polygonal grid rings at the ticks of the radius axis (turn the radius axis' own
 * grid off, it would draw circles).
 */
export class D3PRadarAngleAxisRenderer extends D3PAngleAxisRenderer {
  override readonly name = 'D3PRadarAngleAxisRenderer'

  protected override drawRing(group: Sel, g: D3PPolarGeometry, angles: number[]) {
    const points = angles.map((a) => `${g.cx + g.R * Math.sin(a)},${g.cy - g.R * Math.cos(a)}`).join(' ')
    group.append('polygon').attr('class', 'domain').attr('points', points).attr('fill', 'none').attr('stroke', 'currentColor')
  }

  protected override drawRings(ctx: D3PAxisDrawContext, g: D3PPolarGeometry, angles: number[], grid: Sel): void {
    const radius = ctx.chart.axes.getAxesState().y.find((a) => a.getSystem(ctx.chart) === ctx.system)
    const scale = radius?.getScale(ctx.chart)
    if (!radius || !scale) return
    for (const v of tickValues(scale, radius.props.tickCount)) {
      const r = d3pScaleProjectTo(scale, v as any)
      if (r === undefined || r <= g.r0) continue
      grid.append('polygon').attr('points', angles.map((a) => `${g.cx + r * Math.sin(a)},${g.cy - r * Math.cos(a)}`).join(' '))
    }
  }
}

/** Options of the renderer of a radius axis: the angle it is drawn at. */
export interface D3PRadiusAxisRendererOptions {
  /** Screen angle (degrees, 0 = up, clockwise) of the spoke; default: where the angle range starts. */
  angle?: number
}

/** The radius axis: ticks along a spoke at a fixed angle, and a circle of grid per value. */
export class D3PRadiusAxisRenderer extends D3PAxisRenderer {
  /** The name of the renderer. */
  readonly name: string = 'D3PRadiusAxisRenderer'
  readonly positions = ['radius'] as const
  readonly systemKinds = ['polar'] as const
  /** The angle of the spoke, in degrees, if one was given. */
  protected readonly fixedAngle: number | undefined

  constructor(opts: D3PRadiusAxisRendererOptions = {}) {
    super()
    this.fixedAngle = opts.angle === undefined ? undefined : (opts.angle * Math.PI) / 180
  }

  /** Screen angle (radians, 0 = up, clockwise) at which the spoke is drawn right now. */
  protected spokeAngle(_chart: D3PChart, sys: D3PPolarSystem): number {
    return this.fixedAngle ?? sys.geometry(_chart).a0
  }

  /** Draws the radius axis: ticks along a spoke and a circle of grid for each value. */
  draw(ctx: D3PAxisDrawContext): void {
    const { chart, scale, group, gridGroup, props } = ctx
    const sys = polarOf(ctx)
    const g = sys.geometry(chart)
    const fmt = formatter(ctx)
    const a = this.spokeAngle(chart, sys)
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    // direction perpendicular to the spoke, used to put the ticks and labels beside it
    const nx = Math.cos(a)
    const ny = Math.sin(a)
    group.attr('transform', null).selectAll('*').remove()
    gridGroup?.attr('transform', null).selectAll('*').remove()

    group.append('line').attr('class', 'domain').attr('stroke', 'currentColor').attr('x1', g.cx + dx * g.r0).attr('y1', g.cy + dy * g.r0).attr('x2', g.cx + dx * g.R).attr('y2', g.cy + dy * g.R)
    for (const v of tickValues(scale, props.tickCount)) {
      const r = d3pScaleProjectTo(scale, v as any)
      if (r === undefined) continue
      const px = g.cx + dx * r
      const py = g.cy + dy * r
      const tick = group.append('g').attr('class', 'tick')
      tick.append('line').attr('stroke', 'currentColor').attr('x1', px).attr('y1', py).attr('x2', px + nx * 6).attr('y2', py + ny * 6)
      tick
        .append('text')
        .attr('fill', 'currentColor')
        .attr('font-size', 10)
        .attr('x', px + nx * 9)
        .attr('y', py + ny * 9)
        .attr('text-anchor', textAnchor(nx))
        .attr('dominant-baseline', baseline(ny))
        .text(fmt(v))
      if (r > 0 && gridGroup) {
        if (g.sweep >= Math.PI * 2 - 1e-9) gridGroup.append('circle').attr('cx', g.cx).attr('cy', g.cy).attr('r', r)
        else gridGroup.append('path').attr('d', arcPath(g.cx, g.cy, r, g.a0, g.a0 + g.dir * g.sweep))
      }
    }
    if (gridGroup) styleGrid(gridGroup, props)
  }
}

/**
 * Options of the radius axis that follows the pointer: those of the radius axis, what it does when the pointer leaves (`onLeave`) and the step of angle it snaps to (`snap`).
 */
export interface D3PCursorRadiusAxisRendererOptions extends D3PRadiusAxisRendererOptions {
  /**
   * Where the spoke goes when the pointer leaves the chart: `'stay'` keeps the last angle
   * (default), a number is an angle in degrees to return to.
   */
  onLeave?: 'stay' | number
  /** Round the angle to a multiple of this many degrees (default: no rounding). */
  snap?: number
}

/**
 * A radius axis whose spoke turns to follow the pointer: it lies on the line from the center of
 * the disc to the cursor, as long as the cursor is where the system reads it (over the disc, or
 * within the `reach` of the system around it); farther, the spoke stays where it was.
 */
export class D3PCursorRadiusAxisRenderer extends D3PRadiusAxisRenderer {
  override readonly name = 'D3PCursorRadiusAxisRenderer'
  private readonly onLeave: 'stay' | number
  private readonly snap: number | undefined
  private readonly angles = new Map<D3PChart, number>()

  constructor(opts: D3PCursorRadiusAxisRendererOptions = {}) {
    super(opts)
    this.onLeave = opts.onLeave ?? 'stay'
    this.snap = opts.snap
  }

  protected override spokeAngle(chart: D3PChart, sys: D3PPolarSystem): number {
    return this.angles.get(chart) ?? super.spokeAngle(chart, sys)
  }

  /** Subscribes to the pointer, to follow it. */
  override attach({ chart, system, subs, redraw }: D3PAxisAttachContext): void {
    const sys = system as D3PPolarSystem
    subs.add(
      chart.bus.on(chart.event('mousemove'), (p) => {
        const g = sys.geometry(chart)
        const dx = p.x - g.cx
        const dy = p.y - g.cy
        const distance = Math.hypot(dx, dy)
        // it follows the pointer where the system reads it: over the disc and within `reach` of it
        if (distance < 2 || distance > g.R + g.reach) return
        let a = Math.atan2(dx, -dy)
        if (this.snap) {
          const step = (this.snap * Math.PI) / 180
          a = Math.round(a / step) * step
        }
        this.angles.set(chart, a)
        redraw()
      }),
    )
    subs.add(
      chart.bus.on(chart.event('mouseleave'), () => {
        if (this.onLeave === 'stay') return
        this.angles.set(chart, (this.onLeave * Math.PI) / 180)
        redraw()
      }),
    )
    d3pRequireInteractionArea(chart)
  }

  /** Releases the subscriptions of the chart. */
  override detach(chart: D3PChart): void {
    this.angles.delete(chart)
  }
}

/** Default renderer of an axis position. */
export function d3pDefaultAxisRenderer(position: D3PAxisPosition): D3PAxisRenderer {
  if (position === 'angle') return new D3PAngleAxisRenderer()
  if (position === 'radius') return new D3PRadiusAxisRenderer()
  return new D3PCartesianAxisRenderer()
}
