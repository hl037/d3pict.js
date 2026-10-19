import type * as d3 from 'd3'
import type { D3PChart } from '../chart'
import { rectPath } from '../coords'
import type { D3PSubscriptions } from '../bus'
import type { D3PDragEvent, D3PPointerEvent, D3PViewSnapshot } from '../pointer'
import { d3pIsInvertible, d3pToNumber } from '../util'
import { D3PTool, d3pLike, type D3PToolOptions } from './base'

/**
 * Options of the zoom by selection: those of a tool, and the smallest drag, in pixels, that counts as a selection (`minDelta`).
 */
export interface D3PZoomSelectionToolOptions extends D3PToolOptions {
  /** Minimum width + height (px) for a drag to count as a selection (default 3). */
  minDelta?: number
}

interface SelData {
  /** The chart as it was when the drag started. */
  view?: D3PViewSnapshot
  shape?: d3.Selection<SVGPathElement, unknown, null, undefined>
  minDeltaReached: boolean
}

/**
 * Zoom to a dragged selection (`name: 'zoom-selection'`): a rectangle on cartesian axes, an annular
 * sector on polar ones. Axes without a value at either end of the drag are left alone.
 */
export class D3PZoomSelectionTool extends D3PTool<SelData> {
  /** The smallest drag, in pixels, that counts as a selection. */
  minDelta: number

  constructor(opts: D3PZoomSelectionToolOptions = {}) {
    super('zoom-selection', [], opts)
    this.minDelta = opts.minDelta ?? 3
  }

  protected createData(): SelData {
    return { minDeltaReached: false }
  }

  protected attached(chart: D3PChart, data: SelData, subs: D3PSubscriptions): void {
    subs.add(
      this.bus.on(chart.event('mousedown'), (p: D3PPointerEvent) => {
        if (!this.isActiveOn(chart)) return
        data.view = p.snapshot()
        data.shape?.remove()
        data.minDeltaReached = false
        data.shape = chart.layer.overlay
          .append('path')
          .attr('class', 'zoom-selection')
          .attr('d', rectPath([p.x, p.y], [p.x, p.y]))
          .attr('fill', 'rgba(100,150,255,0.3)')
          .attr('stroke', 'rgba(50,100,200,0.8)')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')
      }),
    )
    subs.add(
      this.bus.on(chart.event('drag'), (p: D3PDragEvent) => {
        if (!this.isActiveOn(chart) || !data.shape) return
        const system = this.resolveAxes(chart)[0]?.getSystem(chart)
        const shape = system?.selectionShape(chart, [p.start.x, p.start.y], [p.x, p.y])
        data.shape.attr('d', shape ? shape.d : rectPath([p.start.x, p.start.y], [p.x, p.y])).attr('transform', shape?.transform ?? null)
        if (Math.abs(p.dx) + Math.abs(p.dy) >= this.minDelta) data.minDeltaReached = true
      }),
    )
    subs.add(
      this.bus.on(chart.event('dragend'), (p: D3PDragEvent) => {
        const view = data.view
        data.view = undefined
        data.shape?.remove()
        data.shape = undefined
        if (!this.isActiveOn(chart) || !view || !data.minDeltaReached) return
        data.minDeltaReached = false
        for (const axis of this.resolveAxes(chart)) {
          const scale = axis.getScale(chart)
          if (!scale || !d3pIsInvertible(scale)) continue
          const s = d3pToNumber(view.getAxis(axis).projectFrom(p.start, undefined, view))
          const e = d3pToNumber(axis.projectFrom(p.point, undefined, p))
          if (s === undefined || e === undefined || s === e) continue
          const like = axis.domain.domain[0]
          axis.domain.domain = [d3pLike(like, Math.min(s, e)), d3pLike(like, Math.max(s, e))]
        }
      }),
    )
    this.requireArea(chart)
  }

  protected override detached(_chart: D3PChart, data: SelData): void {
    data.shape?.remove()
  }
}
