import type { D3PAxis, D3PAxisSnapshot } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PSubscriptions } from '../bus'
import type { D3PDragEvent, D3PPointerEvent, D3PViewSnapshot } from '../pointer'
import { d3pIsInvertible, d3pToNumber } from '../util'
import { D3PTool, d3pLike, type D3PToolOptions } from './base'

interface PanSaved {
  /** The axis as it was when the drag started: its domain, scale and system. */
  start: D3PAxisSnapshot
  /** Where the pointer went down along the axis, in range units. */
  from: number
}
interface PanData {
  view?: D3PViewSnapshot
  saved: Map<D3PAxis, PanSaved>
}

/**
 * Pan by dragging. The axes are snapshotted when the button goes down, and every move is
 * measured against that snapshot, so the result never drifts while the live domain is written
 * under the pointer.
 */
export class D3PPanTool extends D3PTool<PanData> {
  constructor(opts: D3PToolOptions = {}) {
    super('pan', [], opts)
  }

  protected createData(): PanData {
    return { saved: new Map() }
  }

  protected attached(chart: D3PChart, data: PanData, subs: D3PSubscriptions): void {
    subs.add(this.bus.on(chart.event('mousedown'), (p) => this.isActiveOn(chart) && this.begin(chart, data, p)))
    subs.add(this.bus.on(chart.event('drag'), (p) => this.isActiveOn(chart) && this.move(chart, data, p)))
    subs.add(this.bus.on(chart.event('dragend'), () => this.end(data)))
    this.requireArea(chart)
  }

  private end(data: PanData) {
    data.saved.clear()
    data.view = undefined
  }

  private begin(chart: D3PChart, data: PanData, p: D3PPointerEvent) {
    this.end(data)
    const view = (data.view = p.snapshot())
    for (const axis of this.resolveAxes(chart)) {
      const start = view.getAxis(axis)
      if (!d3pIsInvertible(start.scale)) continue
      const from = this.rangeOf(axis, p.point, start.system, view)
      if (from !== undefined) data.saved.set(axis, { start, from })
    }
  }

  private move(chart: D3PChart, data: PanData, p: D3PDragEvent) {
    for (const [axis, { start, from }] of data.saved) {
      const now = this.rangeOf(axis, p.point, start.system, data.view)
      if (now === undefined) continue
      // an angle wraps around: take the short way when the pointer crosses the seam
      const delta = start.system.wrap(chart, axis.component, from - now)
      const [d0, d1] = start.domain
      if (d3pToNumber(d0) === undefined || d3pToNumber(d1) === undefined) continue
      const sc = start.scale as any
      const a = d3pToNumber(sc.invert(sc(d0) + delta))
      const b = d3pToNumber(sc.invert(sc(d1) + delta))
      if (a === undefined || b === undefined) continue
      axis.domain.domain = [d3pLike(d0, a), d3pLike(d1, b)]
    }
  }
}
