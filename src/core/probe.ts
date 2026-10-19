import * as d3 from 'd3'
import type { D3PAxis } from './axis'
import type { D3PChart } from './chart'
import type { D3PCoordinateSystem, D3PJoinGroup } from './coords'
import { D3PObject } from './object'
import type { D3PPointerEvent } from './pointer'
import type { D3PProjectionCache } from './projection'
import type { D3PSeriesRenderer } from './renderers/base'
import type { D3PPoint } from './series'
import { d3pServiceKey } from './services'
import { d3pToNumber, type D3PDomainValue } from './util'

/** What a renderer finds under the pointer: the data tooltips show and markers highlight. */
export interface D3PProbeHit {
  /** The renderer that was hit. */
  renderer: D3PSeriesRenderer
  /** Data point values (domain space), or a category and its magnitude for renderers without axes. */
  x: D3PDomainValue
  /** The value of the point. */
  y: number
  /** Writes the x value. */
  xFormatter: (v: any) => string
  /** Writes the y value. */
  yFormatter: (v: any) => string
  /** Color of the point in the tooltip. */
  color: string
  /** What to call the point in the tooltip (a slice's name); default: the renderer's name. */
  label?: string
  /** Share of a total (0 to 1), when the renderer splits one. */
  percent?: number
  /** What to show as the value when it is not `y` (a stack positions its marker at the top of the layer). */
  value?: number
  /** Every value column of the point, in the order of the series' input, when it has several. */
  fields?: { name: string; value: unknown; format: (v: any) => string }[]
  /** Where the point starts, for renderers that draw between two values (a range area, a layer of a stack). */
  base?: number
  /** Index of the data point in the series, for renderers that draw from one. */
  index?: number
  /** Which part of the renderer was hit (the key of a slice, a stage). */
  key?: string
  /** System of the hit and its position in range units; the tooltip anchors there. Without them it follows the pointer. */
  system?: D3PCoordinateSystem
  /** The position of the hit in range units, along with `system`. */
  range?: [number, number]
  /** The cell under the pointer in range units (a bar, a heatmap cell), for markers that outline it. */
  cell?: { a0: number; a1: number; b0: number; b1: number }
}

/** Key of the service that tells what is under the pointer on a chart (`d3pProbe(chart)`). */
export const D3P_PROBE = d3pServiceKey<D3PProbe>('probe')

/** The probe of `chart`, created when first asked. */
export function d3pProbe(chart: D3PChart): D3PProbe {
  const found = chart.get(D3P_PROBE)
  if (found) return found
  const probe = new D3PProbe(chart)
  chart.provide(D3P_PROBE, probe)
  return probe
}

/** Index of the point of `data` closest to `value`: bisection on sorted numbers and dates, equality for categories. */
export function d3pNearestIndex(data: ReadonlyArray<D3PPoint>, value: D3PDomainValue): number {
  if (!data.length) return -1
  const n = d3pToNumber(value)
  if (n === undefined) return data.findIndex((p) => p[0] === value)
  return d3.bisector((p: D3PPoint) => d3pToNumber(p[0]) ?? NaN).center(data, n)
}

const joinsKey = (joins: readonly D3PJoinGroup[]) => joins.map((g) => [...g.names].join('+')).join('|')

/**
 * What is under the pointer on one chart: the service tooltips, cursors and markers read.
 *
 * It answers from a {@link D3PPointerEvent}, which is the cache: the value along an axis and
 * the hit of a renderer are computed when someone first asks, and once. An event may come
 * from another chart (the tooltip and the cursor follow the pointer across charts); the axes then
 * match by name, by join, or by sharing a domain.
 *
 * The probe also drives the markers of its renderers: as soon as a renderer is attached, the
 * pointer events of the chart show and hide them.
 */
export class D3PProbe extends D3PObject<{}> {
  private tracking = false

  constructor(/** The chart it probes. */ readonly chart: D3PChart) {
    super(`${chart.name}.probe`, [], chart.bus)
    this.subs.add(this.bus.on(chart.e.destroyed, () => this.destroy()))
  }

  /** Make the pointer events of the chart drive the markers of its renderers (once). */
  track(): void {
    if (this.tracking || this.isDestroying) return
    this.tracking = true
    this.subs.add(this.bus.on(this.chart.event('mousemove'), (p) => this.show(p)))
    this.subs.add(this.bus.on(this.chart.event('mouseleave'), () => this.hide()))
    // a drag moves the data under a pointer that no longer reports: do not leave a stale marker behind
    this.subs.add(this.bus.on(this.chart.event('mousedown'), () => this.hide()))
  }

  /**
   * The value `axis` should read for `event`: the one under the pointer when the event is on this
   * chart, otherwise (or when the pointer is outside the system of the axis) the one of an axis
   * of the event's chart with the same name, then of a joined one (explicit joins of the chart
   * or `joins`), then of one sharing the domain of `axis`.
   */
  projectFrom(event: D3PPointerEvent, axis: D3PAxis, joins: readonly D3PJoinGroup[] = [], cache: D3PProjectionCache = event): D3PDomainValue | undefined {
    const own = event.chart === this.chart ? axis.projectFrom(event.point, undefined, cache) : undefined
    if (own !== undefined) return own
    const origin = this.axesOf(event.chart)
    const along = (name: string) => origin.find((a) => a.name === name)?.projectFrom(event.point, undefined, cache)
    const sameName = along(axis.name)
    if (sameName !== undefined) return sameName
    for (const g of [...this.chart.coords.getJoins(), ...joins]) {
      if (!g.names.has(axis.name)) continue
      for (const name of g.names) {
        if (name === axis.name) continue
        const v = along(name)
        if (v === undefined) continue
        const converted = g.convert ? g.convert(v, name, axis.name) : v
        if (converted !== undefined) return converted
      }
    }
    for (const other of [...this.axesOf(this.chart), ...origin]) {
      if (other === axis || other.domain !== axis.domain) continue
      const v = along(other.name)
      if (v !== undefined) return v
    }
    return undefined
  }

  private axesOf(chart: D3PChart): D3PAxis[] {
    const { x, y } = chart.axes.getAxesState()
    return [...x, ...y]
  }

  /** What `renderer` reports for `event` on this chart (computed once per event). */
  hit(event: D3PPointerEvent, renderer: D3PSeriesRenderer, joins: readonly D3PJoinGroup[] = []): D3PProbeHit | undefined {
    if (!renderer.visible) return undefined
    return event.memo(renderer, this.chart, ['hit', joinsKey(joins)], () => renderer.probeHit(this.chart, event, joins))
  }

  /** The hits of the visible renderers of the chart (or of `renderers`), in the order of the renderers. */
  hits(event: D3PPointerEvent, joins: readonly D3PJoinGroup[] = [], renderers: readonly D3PSeriesRenderer[] = this.chart.renderers.getSeries()): D3PProbeHit[] {
    const out: D3PProbeHit[] = []
    for (const r of renderers) {
      const hit = this.hit(event, r, joins)
      if (hit) out.push(hit)
    }
    return out
  }

  /** Show the marker of every renderer that has a hit for `event`, hide the others. */
  show(event: D3PPointerEvent, joins: readonly D3PJoinGroup[] = []): void {
    if (this.isDestroying) return
    for (const r of this.chart.renderers.getSeries()) {
      const marker = r.marker
      if (!marker) continue
      const hit = this.hit(event, r, joins)
      if (hit) marker.show(this.chart, hit, event)
      else marker.hide(this.chart)
    }
  }

  /** Hides the markers of all the renderers. */
  hide(): void {
    if (this.isDestroying) return
    for (const r of this.chart.renderers.getSeries()) r.marker?.hide(this.chart)
  }
}
