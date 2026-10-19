import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'

/**
 * Props of a bubble chart: the style (color, opacity, stroke), the range of the radii and the domain of the sizes.
 */
export interface D3PBubbleProps {
  /** The style: the color, the opacity and the stroke of the bubbles. */
  style: D3PRendererStyleBase & {
    opacity: number
    stroke: string
    strokeWidth: number
  }
  /** Radius, in pixels, of the smallest and of the largest bubble. */
  radius: [number, number]
  /** Values mapped to those radii (default: from 0 to the largest size). Areas follow sizes. */
  sizeDomain?: [number, number]
}

interface BubbleData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
}

/**
 * Bubbles: a scatter plot whose dots have a size. The series needs a `size` column (declare it
 * with `columns: ['x', 'y', 'size']`); the area of a dot is proportional to it. It draws in any
 * coordinate system.
 */
export class D3PBubbleRenderer extends D3PSeriesRenderer<D3PBubbleProps, BubbleData> {
  protected override readonly requiredColumns = ['size'] as const

  constructor(opts: D3PSeriesRendererOptions<D3PBubbleProps>) {
    super(opts, { style: { color: '', opacity: 0.6, stroke: '#fff', strokeWidth: 1 }, radius: [4, 30] })
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): BubbleData {
    return { group: undefined as never }
  }
  protected chartAdded(chart: D3PChart, data: BubbleData): void {
    data.group = this.createGroup(chart)
  }
  protected chartRemoved(_chart: D3PChart, data: BubbleData): void {
    data.group.interrupt().remove()
  }

  private draw(chart: D3PChart, data: BubbleData, x?: D3PAxis, y?: D3PAxis) {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return void data.group.selectAll('*').remove()
    const { system } = scales
    const si = this.series.index('size')
    const sizes = this.series.data.map((p) => p[si] as number).filter((s) => Number.isFinite(s) && s >= 0)
    const [lo, hi] = this.props.sizeDomain ?? [0, d3.max(sizes) ?? 1]
    const radius = d3.scaleSqrt().domain([lo, hi]).range(this.props.radius).clamp(true)
    const dots: { cx: number; cy: number; r: number }[] = []
    for (const p of this.series.data) {
      const at = this.projectToRange(chart, p[0], p[1])
      const size = p[si] as number
      if (!at || !Number.isFinite(size) || size < 0 || !system.inRange(chart, at[0], at[1])) continue
      const center = system.projectTo(chart, at[0], at[1])
      dots.push({ cx: center.x, cy: center.y, r: radius(size) })
    }
    dots.sort((a, b) => b.r - a.r) // small bubbles stay visible on top of large ones
    const { style } = this.props
    data.group.interrupt().attr('opacity', 1)
    data.group
      .selectAll<SVGCircleElement, (typeof dots)[number]>('circle.bubble')
      .data(dots)
      .join('circle')
      .attr('class', 'bubble')
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy)
      .attr('r', (d) => d.r)
      .attr('fill', this.color)
      .attr('fill-opacity', style.opacity)
      .attr('stroke', style.stroke)
      .attr('stroke-width', style.strokeWidth)
  }

  protected renderData(chart: D3PChart, data: BubbleData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y)
  }
  protected renderDataWithTransition(chart: D3PChart, data: BubbleData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y)
    data.group.attr('opacity', 0).transition().duration(D3P_TRANSITION_MS).attr('opacity', 1)
  }
  protected renderDataHidden(_chart: D3PChart, data: BubbleData): void {
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attr('opacity', 0)
      .on('end', () => data.group.selectAll('*').remove())
  }
}
