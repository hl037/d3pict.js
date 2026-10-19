import type { D3PAxis } from '../axis'
import type { D3PAxisDomain } from '../domain'
import type { D3PChart } from '../chart'
import type { D3PSubscriptions } from '../bus'
import type { D3PPointerEvent, D3PWheelEvent } from '../pointer'
import type { D3PViewportPoint } from '../projection'
import { d3pIsInvertible, d3pToNumber } from '../util'
import { D3PTool, d3pLike, type D3PToolOptions } from './base'

/**
 * Zoom `axis` around the position `position` (range units) of `chart`. `magnification` > 1 zooms in (the visible
 * span shrinks), < 1 zooms out. Computed in pixel space then inverted, so log/time scales work.
 */
export function d3pZoomAxis(axis: D3PAxis, chart: D3PChart, position: number, magnification: number): void {
  const scale = axis.getScale(chart) as any
  if (!scale || !d3pIsInvertible(scale) || !(magnification > 0)) return
  const [r0, r1] = scale.range() as [number, number]
  const n0 = d3pToNumber(scale.invert(position + (r0 - position) / magnification))
  const n1 = d3pToNumber(scale.invert(position + (r1 - position) / magnification))
  if (n0 === undefined || n1 === undefined) return
  const [d0, d1] = axis.domain.domain
  axis.domain.domain = [d3pLike(d0, n0), d3pLike(d1, n1)]
}

function rangeMiddle(axis: D3PAxis, chart: D3PChart): number {
  const range = (axis.getScale(chart) as any)?.range?.() as [number, number] | undefined
  return range ? (range[0] + range[1]) / 2 : 0
}

/** Options of a zoom tool: those of a tool, and the factor of one step (`zoomFactor`). */
export interface D3PZoomToolOptions extends D3PToolOptions {
  /**
   * Factor by which the visible span is multiplied by one zoom-in step (default 0.8, i.e.
   * zoom-in shrinks the domain to 80 %). Must be in (0, 1).
   */
  zoomFactor?: number
}

/**
 * Programmatic zoom (buttons +/−). `zoomInAll` / `zoomOutAll` have the same meaning in every
 * zoom tool. Like any tool it only acts on the charts it is attached to.
 */
export class D3PZoomTool<D = {}> extends D3PTool<D> {
  /** The factor of one step: the domain is divided by it to zoom in, multiplied to zoom out. */
  zoomFactor: number

  constructor(name: string, opts: D3PZoomToolOptions = {}) {
    super(name, [], opts)
    this.zoomFactor = opts.zoomFactor ?? 0.8
  }

  protected createData(): D {
    return {} as D
  }
  protected attached(_chart: D3PChart, _data: D, _subs: D3PSubscriptions): void {}

  /** Zoom around a viewport point; `magnification` > 1 zooms in. */
  zoom(point: D3PViewportPoint, magnification: number): void {
    for (const axis of this.resolveAxes(point.chart)) {
      const position = this.rangeOf(axis, point)
      if (position !== undefined) d3pZoomAxis(axis, point.chart, position, magnification)
    }
  }

  /** Zoom every axis around the middle of its range (the center of the chart for cartesian axes). */
  centeredZoom(chart: D3PChart, magnification: number): void {
    for (const axis of this.resolveAxes(chart)) d3pZoomAxis(axis, chart, rangeMiddle(axis, chart), magnification)
  }

  /** Zoom every attached chart around its center; a domain shared by several axes/charts is zoomed once. */
  zoomAll(magnification: number): void {
    const done = new Set<D3PAxisDomain>()
    for (const chart of this.getCharts()) {
      for (const axis of this.resolveAxes(chart)) {
        if (done.has(axis.domain)) continue
        done.add(axis.domain)
        d3pZoomAxis(axis, chart, rangeMiddle(axis, chart), magnification)
      }
    }
  }

  /** Zooms in on every axis the tool acts on, around its center. */
  zoomInAll(): void {
    this.zoomAll(1 / this.zoomFactor)
  }
  /** Zooms out on every axis the tool acts on, around its center. */
  zoomOutAll(): void {
    this.zoomAll(this.zoomFactor)
  }
}

/** Passive zoom tool (`name: 'zoom'`): API only, no mouse listener. */
export class D3PPassiveZoomTool extends D3PZoomTool {
  constructor(opts: D3PZoomToolOptions = {}) {
    super('zoom', opts)
  }
}

/** Zoom in at the click position (`name: 'zoom-click'`). */
export class D3PClickZoomTool extends D3PZoomTool {
  constructor(opts: D3PZoomToolOptions = {}) {
    super('zoom-click', opts)
  }

  protected override attached(chart: D3PChart, _data: {}, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.event('mousedown'), (p: D3PPointerEvent) => this.isActiveOn(chart) && this.zoom(p.point, 1 / this.zoomFactor)))
    this.requireArea(chart)
  }
}

/** Options of the wheel zoom: those of a tool, and the factor of one step (`zoomFactor`). */
export interface D3PWheelZoomToolOptions extends D3PToolOptions {
  /** Relative zoom per wheel notch (default 0.1). */
  zoomFactor?: number
}

/** Zoom with the wheel around the pointer (`name: 'wheel-zoom'`): scrolling up zooms in. */
export class D3PWheelZoomTool extends D3PTool {
  /** The factor of one step of the wheel. */
  zoomFactor: number

  constructor(opts: D3PWheelZoomToolOptions = {}) {
    super('wheel-zoom', [], opts)
    this.zoomFactor = opts.zoomFactor ?? 0.1
  }

  protected createData() {
    return {}
  }

  protected attached(chart: D3PChart, _data: {}, subs: D3PSubscriptions): void {
    subs.add(
      this.bus.on(chart.event('wheel'), (p: D3PWheelEvent) => {
        if (!this.isActiveOn(chart)) return
        const m = p.delta > 0 ? 1 - this.zoomFactor : 1 + this.zoomFactor
        for (const axis of this.resolveAxes(chart)) {
          const position = this.rangeOf(axis, p.point, undefined, p)
          if (position !== undefined) d3pZoomAxis(axis, chart, position, m)
        }
      }),
    )
    this.requireArea(chart)
  }
}
