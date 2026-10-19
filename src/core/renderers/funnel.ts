import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PSubscriptions } from '../bus'
import type { D3PChart } from '../chart'
import { D3PFunctionMarker, type D3PMarker } from '../marker'
import type { D3PPointerEvent } from '../pointer'
import type { D3PProbeHit } from '../probe'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PLegendItem, type D3PRendererChartData, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'

/** A stage of a funnel: its label, value, share of the largest stage, color and shape. */
export interface D3PFunnelStage {
  /** Identifies the stage: its category. */
  key: string
  /** The label of the stage. */
  label: string
  /** The value of the stage. */
  value: number
  /** Share of the largest stage (0 to 1): the conversion from the top of the funnel. */
  percent: number
  /** Color of the stage. */
  color: string
  /** Vertical extent in the inner area, and the width at the top and at the bottom. */
  y0: number
  /** Bottom of the stage, in pixels from the top of the plot. */
  y1: number
  /** Width of the top of the stage, in pixels. */
  w0: number
  /** Width of the bottom of the stage, in pixels. */
  w1: number
}

/**
 * Props of a funnel: its style, its shape, the order of the stages, the gap between them, its width and its neck, the hover effect and the labels.
 */
export interface D3PFunnelProps {
  /** The style: the colors of the stages (by position, cycled), and the stroke between them. */
  style: D3PRendererStyleBase & {
    colors?: string[]
    stroke: string
    strokeWidth: number
  }
  /** `funnel`: each stage narrows to the next one. `bars`: centered rectangles. */
  shape: 'funnel' | 'bars'
  /** `descending` puts the largest stage on top (default); `none` keeps the data order. */
  sort: 'none' | 'descending'
  /** Gap between stages, in pixels. */
  gap: number
  /** Width of the widest stage, as a fraction of the chart (default 0.9). */
  width: number
  /** Width of the bottom of the last stage, as a fraction of its top (`funnel` shape). */
  neck: number
  /** Dim the other stages while one is hovered (asks for an interaction area). */
  hover: boolean
  /** `auto` writes inside a stage when the text fits, beside it otherwise. */
  labels: { enabled: boolean; position: 'auto' | 'inside' | 'outside'; color: string; outsideColor: string; format?: (stage: D3PFunnelStage) => string }
}

interface FunnelData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  hovered?: string
}

/**
 * A funnel: one stage per point of the series (`x` its name, `y` its size), widths proportional
 * to sizes. No axes, so no coordinate system either: it uses the whole inner area. Its legend has
 * one entry per stage (which hides it), and its tooltip tests the pointer against the stages.
 */
export class D3PFunnelRenderer extends D3PSeriesRenderer<D3PFunnelProps, FunnelData> {
  private readonly hidden = new Set<string>()

  constructor(opts: D3PSeriesRendererOptions<D3PFunnelProps>) {
    super(opts, {
      style: { color: '', colors: [...d3.schemeTableau10], stroke: '#fff', strokeWidth: 1 },
      shape: 'funnel',
      sort: 'descending',
      gap: 3,
      width: 0.9,
      neck: 0.6,
      hover: true,
      labels: { enabled: true, position: 'auto', color: '#fff', outsideColor: 'currentColor' },
    })
  }

  private items() {
    const palette = this.props.style.colors?.length ? this.props.style.colors : d3.schemeTableau10
    return this.series.data
      .map(([x, y], i) => ({ key: String(x), label: String(x), value: y as number, color: palette[i % palette.length] }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
  }

  /** The stages laid out in the inner area of `chart`, top to bottom. */
  stages(chart: D3PChart): D3PFunnelStage[] {
    const shown = this.items().filter((d) => !this.hidden.has(d.key))
    if (!shown.length) return []
    if (this.props.sort === 'descending') shown.sort((a, b) => b.value - a.value)
    const { gap, width, neck, shape } = this.props
    const max = d3.max(shown, (d) => d.value)!
    const full = chart.innerWidth * width
    const h = Math.max(0, (chart.innerHeight - gap * (shown.length - 1)) / shown.length)
    const w = (v: number) => (v / max) * full
    return shown.map((d, i) => {
      const w0 = w(d.value)
      const w1 = shape === 'bars' ? w0 : i < shown.length - 1 ? w(shown[i + 1].value) : w0 * neck
      return { ...d, percent: d.value / max, y0: i * (h + gap), y1: i * (h + gap) + h, w0, w1 }
    })
  }

  override legendEntries(): D3PLegendItem[] {
    return this.items()
      .filter((d, i, all) => all.findIndex((o) => o.key === d.key) === i)
      .map((d) => ({
        key: d.key,
        label: d.label,
        color: d.color,
        visible: !this.hidden.has(d.key),
        toggle: () => {
          if (!this.hidden.delete(d.key)) this.hidden.add(d.key)
          this.entriesChanged()
          this.tagDirtyWithTransition()
        },
      }))
  }

  protected override seriesChanged(): void {
    this.entriesChanged()
  }

  override getAxes(): { x?: D3PAxis; y?: D3PAxis } {
    return {}
  }
  override projectTo(): undefined {
    return undefined
  }
  override projectFrom(): undefined {
    return undefined
  }

  override probeHit(chart: D3PChart, event: D3PPointerEvent): D3PProbeHit | undefined {
    if (event.chart !== chart || !this.visible) return undefined
    const { x, y } = event
    const s = this.stages(chart).find((st) => y >= st.y0 && y <= st.y1)
    if (!s) return undefined
    const w = s.w0 + ((s.w1 - s.w0) * (y - s.y0)) / (s.y1 - s.y0 || 1)
    if (Math.abs(x - chart.innerWidth / 2) > w / 2) return undefined
    const plain = (v: unknown) => String(v)
    return { renderer: this, x: s.label, y: s.value, key: s.key, label: s.label, percent: s.percent, color: s.color, xFormatter: plain, yFormatter: plain }
  }

  /** Dims the other stages while one is under the pointer. */
  override createMarker(): D3PMarker {
    return new D3PFunctionMarker({
      interactive: () => this.props.hover,
      show: (chart, hit) => this.highlight(chart, hit.key),
      hide: (chart) => this.highlight(chart, undefined),
    })
  }

  private highlight(chart: D3PChart, key: string | undefined) {
    const funnel = this.chartData.get(chart)?.data
    if (!funnel || !this.props.hover || key === funnel.hovered) return
    funnel.hovered = key
    funnel.group.selectAll<SVGPathElement, D3PFunnelStage>('path.stage').attr('opacity', (d) => (key === undefined || d.key === key ? 1 : 0.55))
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): FunnelData {
    return { group: undefined as never }
  }
  /** Creates the group the stages are drawn in. */
  protected chartAdded(chart: D3PChart, data: FunnelData): void {
    data.group = this.createGroup(chart)
  }
  /** Removes the stages of the chart. */
  protected chartRemoved(_chart: D3PChart, data: FunnelData): void {
    data.group.interrupt().remove()
  }

  protected override attached(chart: D3PChart, data: D3PRendererChartData<FunnelData>, subs: D3PSubscriptions): void {
    super.attached(chart, data, subs)
    subs.add(this.bus.on(chart.e.resized, () => this.tagDirty(chart)))
  }

  private draw(chart: D3PChart, data: FunnelData) {
    const stages = this.stages(chart)
    const { style, labels } = this.props
    const cx = chart.innerWidth / 2
    const outline = (s: D3PFunnelStage) => `M${cx - s.w0 / 2},${s.y0}L${cx + s.w0 / 2},${s.y0}L${cx + s.w1 / 2},${s.y1}L${cx - s.w1 / 2},${s.y1}Z`
    data.group.interrupt().attr('opacity', 1)
    data.group
      .selectAll<SVGPathElement, D3PFunnelStage>('path.stage')
      .data(stages, (d) => d.key)
      .join('path')
      .attr('class', 'stage')
      .attr('d', outline)
      .attr('fill', (d) => d.color)
      .attr('stroke', style.stroke)
      .attr('stroke-width', style.strokeWidth)
      .attr('opacity', (d) => (data.hovered === undefined || d.key === data.hovered ? 1 : 0.55))
    const format = labels.format ?? ((s: D3PFunnelStage) => `${s.label}: ${s.value}`)
    const fits = (s: D3PFunnelStage) => {
      if (labels.position !== 'auto') return labels.position === 'inside'
      return Math.min(s.w0, s.w1) > format(s).length * 7 + 10 // about 7 px a character at 12 px
    }
    data.group
      .selectAll<SVGTextElement, D3PFunnelStage>('text.label')
      .data(labels.enabled ? stages : [], (d) => d.key)
      .join('text')
      .attr('class', 'label')
      .attr('x', (d) => (fits(d) ? cx : cx + Math.max(d.w0, d.w1) / 2 + 8))
      .attr('y', (d) => (d.y0 + d.y1) / 2)
      .attr('text-anchor', (d) => (fits(d) ? 'middle' : 'start'))
      .attr('dominant-baseline', 'central')
      .attr('font-size', 12)
      .attr('fill', (d) => (fits(d) ? labels.color : labels.outsideColor))
      .style('pointer-events', 'none')
      .text((d) => format(d))
  }

  /** Draws the stages at once, with no transition. */
  protected renderData(chart: D3PChart, data: FunnelData): void {
    this.draw(chart, data)
  }
  /** Draws the stages moving from what is on screen to what the data says now. */
  protected renderDataWithTransition(chart: D3PChart, data: FunnelData): void {
    this.draw(chart, data)
    data.group.attr('opacity', 0).transition().duration(D3P_TRANSITION_MS).attr('opacity', 1)
  }
  /** Draws the stages going away. */
  protected renderDataHidden(_chart: D3PChart, data: FunnelData): void {
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attr('opacity', 0)
      .on('end', () => data.group.selectAll('*').remove())
  }
}
