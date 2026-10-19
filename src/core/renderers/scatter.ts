import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem } from '../coords'
import { D3PDotMarker, type D3PMarker } from '../marker'
import { d3pInterpolateSeries, type D3PPixelPoint, type D3PPlacedSeries } from '../series'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'
import type { D3PScale } from '../util'
import { d3pBaseline, d3pRangePositions } from './path'

/** Props of a scatter plot: the style (color, radius). */
export interface D3PScatterProps {
  /** The style: the color and the radius of the points. */
  style: D3PRendererStyleBase & { radius: number }
}

interface ScatterData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  last?: D3PPlacedSeries
}

/**
 * A dot for each point of a series.
 */
export class D3PScatterRenderer extends D3PSeriesRenderer<D3PScatterProps, ScatterData> {
  override createMarker(): D3PMarker {
    return new D3PDotMarker(this)
  }

  constructor(opts: D3PSeriesRendererOptions<D3PScatterProps>) {
    super(opts, { style: { color: '', radius: 4 } })
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): ScatterData {
    return { group: undefined as never }
  }
  protected chartAdded(chart: D3PChart, data: ScatterData): void {
    data.group = this.createGroup(chart)
  }
  protected chartRemoved(_chart: D3PChart, data: ScatterData): void {
    data.group.interrupt().remove()
  }

  private clear(data: ScatterData) {
    data.group.interrupt().selectAll('*').remove()
    data.last = undefined
  }

  /** Pixel position of a point in range units. */
  private px(chart: D3PChart, system: D3PCoordinateSystem, p: D3PPixelPoint): D3PPixelPoint {
    const at = system.projectTo(chart, p[0], p[1])
    return [at.x, at.y]
  }

  private circles(data: ScatterData, pos: D3PPixelPoint[]) {
    return data.group.selectAll<SVGCircleElement, D3PPixelPoint>('circle.point').data(pos)
  }

  /** The points inside the plot, with the x value each one comes from. */
  private placed(chart: D3PChart, scales: { sx: D3PScale; sy: D3PScale; system: D3PCoordinateSystem }): D3PPlacedSeries {
    const all = d3pRangePositions(this.series.data, scales.sx, scales.sy)
    const out: D3PPlacedSeries = { keys: [], points: [] }
    all.points.forEach((p, i) => {
      if (!scales.system.inRange(chart, p[0], p[1])) return
      out.keys.push(all.keys[i])
      out.points.push(p)
    })
    return out
  }

  protected renderData(chart: D3PChart, data: ScatterData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return this.clear(data)
    const pos = this.placed(chart, scales)
    const { radius } = this.props.style
    data.group.interrupt()
    this.circles(data, pos.points)
      .join('circle')
      .attr('class', 'point')
      .attr('r', radius)
      .attr('fill', this.color)
      .attr('opacity', 1)
      .attr('cx', (p) => this.px(chart, scales.system, p)[0])
      .attr('cy', (p) => this.px(chart, scales.system, p)[1])
    data.last = pos
  }

  protected renderDataWithTransition(chart: D3PChart, data: ScatterData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return this.clear(data)
    const pos = this.placed(chart, scales)
    const { radius } = this.props.style
    const color = this.color
    const interp = d3pInterpolateSeries(data.last ?? d3pBaseline(scales.sy), pos)
    // circles are joined by index against the (longer or equal) interpolated list so none pops in
    const frame0 = interp(0)
    this.circles(data, frame0)
      .join('circle')
      .attr('class', 'point')
      .attr('r', radius)
      .attr('fill', color)
      .attr('opacity', 1)
      .attr('cx', (p) => this.px(chart, scales.system, p)[0])
      .attr('cy', (p) => this.px(chart, scales.system, p)[1])
    const self = this
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .tween('points', () => (t) => {
        const p = interp(t)
        data.last = { keys: interp.keys, points: p }
        data.group.selectAll<SVGCircleElement, unknown>('circle.point').each(function (_d, i) {
          if (p[i]) {
            const q = self.px(chart, scales.system, p[i])
            d3.select(this).attr('cx', q[0]).attr('cy', q[1])
          }
        })
      })
      .on('end', () => {
        data.last = pos
        this.circles(data, pos.points)
          .join('circle')
          .attr('class', 'point')
          .attr('r', radius)
          .attr('fill', color)
          .attr('cx', (p) => this.px(chart, scales.system, p)[0])
          .attr('cy', (p) => this.px(chart, scales.system, p)[1])
      })
  }

  protected renderDataHidden(chart: D3PChart, data: ScatterData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return this.clear(data)
    const from = data.last ?? this.placed(chart, scales)
    const base = d3pBaseline(scales.sy)
    const interp = d3pInterpolateSeries(from, { keys: from.keys, points: from.points.map(([a]) => [a, base] as D3PPixelPoint) })
    const self = this
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .tween('hide', () => (t) => {
        const p = interp(t)
        data.last = { keys: interp.keys, points: p }
        data.group.selectAll<SVGCircleElement, unknown>('circle.point').each(function (_d, i) {
          if (p[i]) {
            const q = self.px(chart, scales.system, p[i])
            d3.select(this).attr('cx', q[0]).attr('cy', q[1]).attr('opacity', 1 - t)
          }
        })
      })
      .on('end', () => this.clear(data))
  }
}
