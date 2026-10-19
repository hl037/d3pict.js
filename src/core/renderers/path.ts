import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem, D3PJoinGroup } from '../coords'
import { D3PDotMarker, type D3PMarker } from '../marker'
import type { D3PPointerEvent } from '../pointer'
import type { D3PProbeHit } from '../probe'
import { d3pInterpolateSeries, d3pPointKey, type D3PPixelPoint, type D3PPlacedSeries } from '../series'
import { d3pScaleProjectTo, type D3PCurve, type D3PScale } from '../util'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PRendererStyleBase } from './base'

/** Style shared by the line and area renderers. */
export interface D3PPathStyle extends D3PRendererStyleBase {
  /** How points are joined (default `linear`). */
  curve: D3PCurve
  /** `connect` skips missing values (default), `break` leaves a gap. */
  gaps: 'connect' | 'break'
  /** Join the last point to the first: the outline of a radar chart. */
  closed: boolean
}

/**
 * What a line or area renderer keeps for a chart: its group, its path, and what is currently on screen.
 */
export interface D3PPathData {
  /** The group the path is in. */
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The path, once it is drawn. */
  path?: d3.Selection<SVGPathElement, unknown, null, undefined>
  /** What is currently on screen: positions and x values (updated every frame of a transition). */
  last?: D3PPlacedSeries
}

type Attrs = Record<string, string | number>

/**
 * Positions of the series in range units (pixels for a cartesian system, radians and distance
 * for a polar one), skipping points the scales cannot place, or keeping them as gaps (`gaps`).
 * With `baseIndex`, each point also carries the position of the base value of that column. Each
 * point comes with its key, the x value it was placed from.
 */
export function d3pRangePositions(
  data: ReadonlyArray<readonly [any, number, ...any[]]>,
  sx: D3PScale,
  sy: D3PScale,
  opts: { gaps?: boolean; baseIndex?: number } = {},
): D3PPlacedSeries {
  const out: D3PPlacedSeries = { keys: [], points: [] }
  const add = (key: number, point: D3PPixelPoint) => (out.keys.push(key), out.points.push(point))
  for (const row of data) {
    const px = d3pScaleProjectTo(sx, row[0])
    const py = d3pScaleProjectTo(sy, row[1])
    const base = opts.baseIndex === undefined ? undefined : d3pScaleProjectTo(sy, row[opts.baseIndex])
    const placed = px !== undefined && Number.isFinite(px) && py !== undefined && Number.isFinite(py) && (opts.baseIndex === undefined || (base !== undefined && Number.isFinite(base)))
    if (placed) add(d3pPointKey(row[0], px!), base === undefined ? [px!, py!] : [px!, py!, base])
    else if (opts.gaps && px !== undefined && Number.isFinite(px)) add(d3pPointKey(row[0], px), opts.baseIndex === undefined ? [px, NaN] : [px, NaN, NaN]) // a gap: the path breaks here
  }
  return out
}

/** Second-dimension value of the baseline (bottom of a cartesian chart, inner radius of a polar one). */
export function d3pBaseline(sy: D3PScale): number {
  return (sy as any).range()[0]
}

/** Shared drawing logic of the line and area renderers (one `<path>`, interpolated between frames). */
export abstract class D3PPathRenderer<P extends { style: D3PPathStyle }> extends D3PSeriesRenderer<P, D3PPathData> {
  /** The CSS class of the path. */
  protected abstract readonly pathClass: string

  override createMarker(): D3PMarker {
    return new D3PDotMarker(this)
  }

  override probeHit(chart: D3PChart, event: D3PPointerEvent, joins: readonly D3PJoinGroup[] = []): D3PProbeHit | undefined {
    const hit = super.probeHit(chart, event, joins)
    const column = this.baseColumn()
    if (hit && column !== undefined && hit.index !== undefined) {
      const base = this.series.data[hit.index][this.series.index(column)]
      if (typeof base === 'number' && Number.isFinite(base)) hit.base = base
    }
    return hit
  }

  /** `fixed` never changes; `animated` is tweened (and driven to its hidden value when hidden). */
  protected abstract pathStyle(props: P, hidden: boolean): { fixed: Attrs; animated: Attrs }
  /** The d3 generator that turns the positions into the `d` of the path. */
  protected abstract pathGenerator(chart: D3PChart, system: D3PCoordinateSystem, sy: D3PScale): (pts: D3PPixelPoint[]) => string | null
  /** Column holding the base of each point (an area between two curves), if any. */
  protected baseColumn(): string | undefined {
    return undefined
  }

  private positions(scales: { sx: D3PScale; sy: D3PScale }): D3PPlacedSeries {
    const base = this.baseColumn()
    const pts = d3pRangePositions(this.series.data, scales.sx, scales.sy, {
      gaps: this.props.style.gaps === 'break',
      baseIndex: base === undefined ? undefined : this.series.index(base),
    })
    if (this.props.style.closed && pts.points.length > 2) (pts.keys.push(pts.keys[0]), pts.points.push([...pts.points[0]] as D3PPixelPoint))
    return pts
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(chart: D3PChart): D3PPathData {
    return { group: undefined as never }
  }

  protected chartAdded(chart: D3PChart, data: D3PPathData): void {
    data.group = this.createGroup(chart)
  }

  protected chartRemoved(_chart: D3PChart, data: D3PPathData): void {
    data.group.interrupt().remove()
  }

  private clear(data: D3PPathData) {
    data.path?.interrupt()
    data.group.selectAll('*').remove()
    data.path = undefined
    data.last = undefined
  }

  private ensurePath(data: D3PPathData, initialAnimated?: Attrs) {
    if (data.path) return data.path
    data.path = data.group.append('path').attr('class', this.pathClass) as any
    if (initialAnimated) for (const k of Object.keys(initialAnimated)) data.path!.attr(k, 0)
    return data.path!
  }

  protected renderData(chart: D3PChart, data: D3PPathData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return this.clear(data)
    const pos = this.positions(scales)
    const st = this.pathStyle(this.props as unknown as P, false)
    const path = this.ensurePath(data)
    path.interrupt()
    for (const [k, v] of Object.entries({ ...st.fixed, ...st.animated })) path.attr(k, v)
    path.attr('d', this.pathGenerator(chart, scales.system, scales.sy)(pos.points))
    data.last = pos
  }

  protected renderDataWithTransition(chart: D3PChart, data: D3PPathData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return this.clear(data)
    const pos = this.positions(scales)
    const st = this.pathStyle(this.props as unknown as P, false)
    const gen = this.pathGenerator(chart, scales.system, scales.sy)
    const isNew = !data.path
    const path = this.ensurePath(data, st.animated)
    for (const [k, v] of Object.entries(st.fixed)) path.attr(k, v)
    if (isNew) path.attr('d', gen([]))
    const interp = d3pInterpolateSeries(data.last ?? d3pBaseline(scales.sy), pos)
    const tr = path
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attrTween('d', () => (t) => {
        const p = interp(t)
        data.last = { keys: interp.keys, points: p }
        return gen(p) ?? ''
      })
      .on('end', () => {
        // the last frame still carries the points added to match the previous shape
        data.last = pos
        path.attr('d', gen(pos.points))
      })
    for (const [k, v] of Object.entries(st.animated)) tr.attr(k, v)
  }

  protected renderDataHidden(chart: D3PChart, data: D3PPathData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!data.path || !scales) return this.clear(data)
    const path = data.path
    const gen = this.pathGenerator(chart, scales.system, scales.sy)
    const from = data.last ?? this.positions(scales)
    const base = d3pBaseline(scales.sy)
    const interp = d3pInterpolateSeries(from, { keys: from.keys, points: from.points.map((p) => [p[0], base, ...p.slice(2).map(() => base)] as D3PPixelPoint) })
    const tr = path
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attrTween('d', () => (t) => {
        const p = interp(t)
        data.last = { keys: interp.keys, points: p }
        return gen(p) ?? ''
      })
      .on('end', () => this.clear(data))
    for (const [k, v] of Object.entries(this.pathStyle(this.props as unknown as P, true).animated)) tr.attr(k, v)
  }
}
