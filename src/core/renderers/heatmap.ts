import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import { D3PColorScale } from '../color'
import type { D3PSubscriptions } from '../bus'
import type { D3PJoinGroup } from '../coords'
import { D3PCellMarker, type D3PMarker } from '../marker'
import type { D3PPointerEvent } from '../pointer'
import type { D3PProbeHit } from '../probe'
import { d3pIsBand, type D3PScale } from '../util'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PLegendItem, type D3PRendererChartData, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'

/** Props of a heatmap: the style of the cells. */
export interface D3PHeatmapProps {
  /** The style: the gap between cells and their corner radius. */
  style: D3PRendererStyleBase & {
    stroke: string
    strokeWidth: number
    opacity: number
  }
}

/** Options of a heatmap: those of a series renderer, and the color scale `colors`. */
export interface D3PHeatmapOptions extends D3PSeriesRendererOptions<D3PHeatmapProps> {
  /** Maps values to colors; default: a scale fitted to the data of the series. */
  colors?: D3PColorScale
}

interface Cell {
  a0: number
  a1: number
  b0: number
  b1: number
  color: string
  x: unknown
  y: unknown
  value: number
}

interface HeatmapData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  tag?: string
}

/**
 * A grid of cells colored by a value. The series has the columns `x` and `y` (both categories,
 * on band or point axes) and `value`; the primary column is `value`:
 * `new D3PSeries({ columns: ['x', 'y', 'value'], primary: 'value', data })`. Link its axes with a
 * named auto domain mapping (`{ x: dx, y: dy }`). It draws cells in any coordinate system, so a
 * polar heatmap is a heatmap on polar axes.
 */
export class D3PHeatmapRenderer extends D3PSeriesRenderer<D3PHeatmapProps, HeatmapData> {
  protected override readonly requiredColumns = ['y', 'value'] as const
  /** The color scale the cells are colored by. */
  readonly colors: D3PColorScale
  private readonly ownScale: boolean

  constructor(opts: D3PHeatmapOptions) {
    super(opts, { style: { color: '', stroke: '#fff', strokeWidth: 0.5, opacity: 1 } })
    this.ownScale = !opts.colors
    this.colors = opts.colors ?? new D3PColorScale({ bus: opts.bus })
    if (this.ownScale) this.fitOwnScale()
  }

  /** A scale of our own follows the data. */
  private fitOwnScale() {
    const values = this.series.has('value') ? this.series.column('value').filter(Number.isFinite) : []
    if (!values.length) return
    const [lo, hi] = d3.extent(values) as [number, number]
    const [a, b] = this.colors.extent()
    if (a !== lo || b !== hi) this.colors.domain.domain = [lo, hi]
  }

  protected override seriesChanged(): void {
    if (this.ownScale) this.fitOwnScale()
  }

  /** The color legend is a `D3PColorLegend` of the scale: no line per series here. */
  override legendEntries(): D3PLegendItem[] {
    return []
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): HeatmapData {
    return { group: undefined as never }
  }
  protected chartAdded(chart: D3PChart, data: HeatmapData): void {
    data.group = this.createGroup(chart)
  }
  protected chartRemoved(_chart: D3PChart, data: HeatmapData): void {
    data.group.interrupt().remove()
  }

  protected override attached(chart: D3PChart, data: D3PRendererChartData<HeatmapData>, subs: D3PSubscriptions): void {
    super.attached(chart, data, subs)
    subs.add(this.bus.on(this.colors.e.changed, () => this.tagDirty(chart)))
  }

  protected override onDestroy(): void {
    if (this.ownScale) this.colors.destroy()
    super.onDestroy()
  }

  // ----- geometry -----

  /** Start and size of a category along its axis. */
  private slot(scale: D3PScale, v: unknown): [number, number] | undefined {
    const s = scale as any
    const at = s(v) as number | undefined
    if (at === undefined || !Number.isFinite(at)) return undefined
    if (d3pIsBand(scale)) return [at, s.bandwidth() || s.step()]
    return undefined
  }

  private cells(sx: D3PScale, sy: D3PScale): Cell[] {
    const series = this.series
    const yi = series.index('y')
    const vi = series.index('value')
    const out: Cell[] = []
    for (const p of series.data) {
      const a = this.slot(sx, p[0])
      const b = this.slot(sy, p[yi])
      const value = p[vi] as number
      if (!a || !b || !Number.isFinite(value)) continue
      out.push({ a0: a[0], a1: a[0] + a[1], b0: b[0], b1: b[0] + b[1], color: this.colors.color(value), x: p[0], y: p[yi], value })
    }
    return out
  }

  // ----- drawing -----

  private draw(chart: D3PChart, data: HeatmapData, x: D3PAxis | undefined, y: D3PAxis | undefined) {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return void data.group.selectAll('*').remove()
    if (!d3pIsBand(scales.sx) || !d3pIsBand(scales.sy)) {
      throw new Error(`[d3pict] renderer "${this.name}" (D3PHeatmapRenderer) needs band scales on both axes ("${x!.name}" is ${x!.scaleType}, "${y!.name}" is ${y!.scaleType}): categories on both`)
    }
    const { system } = scales
    const tag = system.kind === 'cartesian' ? 'rect' : 'path'
    if (data.tag !== tag) {
      data.group.selectAll('*').remove()
      data.tag = tag
    }
    const { style } = this.props
    data.group.interrupt().attr('opacity', 1)
    data.group
      .selectAll<SVGElement, Cell>(`${tag}.cell`)
      .data(this.cells(scales.sx, scales.sy))
      .join(tag)
      .attr('class', 'cell')
      .attr('fill', (d) => d.color)
      .attr('opacity', style.opacity)
      .attr('stroke', style.stroke)
      .attr('stroke-width', style.strokeWidth)
      .each(function (d) {
        const shape = system.cellShape(chart, d.a0, d.a1, d.b0, d.b1)
        const node = d3.select(this)
        if (shape.tag === 'rect') node.attr('x', shape.x).attr('y', shape.y).attr('width', shape.width).attr('height', shape.height)
        else node.attr('d', shape.d).attr('transform', shape.transform ?? null)
      })
  }

  protected renderData(chart: D3PChart, data: HeatmapData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y)
  }
  protected renderDataWithTransition(chart: D3PChart, data: HeatmapData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y)
    data.group.attr('opacity', 0).transition().duration(D3P_TRANSITION_MS).attr('opacity', 1)
  }
  protected renderDataHidden(_chart: D3PChart, data: HeatmapData): void {
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attr('opacity', 0)
      .on('end', () => data.group.selectAll('*').remove())
  }

  // ----- tooltip -----

  override createMarker(): D3PMarker {
    return new D3PCellMarker()
  }

  override probeHit(chart: D3PChart, event: D3PPointerEvent, _joins: readonly D3PJoinGroup[] = []): D3PProbeHit | undefined {
    if (event.chart !== chart) return undefined
    const { x, y } = this.getAxes(chart)
    const scales = this.scalesOf(chart, x, y)
    if (!scales || !d3pIsBand(scales.sx) || !d3pIsBand(scales.sy)) return undefined
    const at = scales.system.projectFrom(event.point, undefined, event)
    if (!at) return undefined
    const cell = this.cells(scales.sx, scales.sy).find(
      (c) => at[0] >= Math.min(c.a0, c.a1) && at[0] <= Math.max(c.a0, c.a1) && at[1] >= Math.min(c.b0, c.b1) && at[1] <= Math.max(c.b0, c.b1),
    )
    if (!cell) return undefined
    return {
      renderer: this,
      x: String(cell.x),
      y: cell.value,
      label: `${cell.x} · ${cell.y}`,
      color: cell.color,
      xFormatter: (v) => String(v),
      yFormatter: (v) => d3.format('.4~g')(v),
      system: scales.system,
      cell: { a0: cell.a0, a1: cell.a1, b0: cell.b0, b1: cell.b1 },
    }
  }
}

