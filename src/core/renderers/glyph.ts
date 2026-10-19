import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PPoint } from '../series'
import { d3pIsBand, type D3PScale } from '../util'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PLegendItem, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'

type Sel = d3.Selection<SVGGElement, unknown, null, undefined>

/**
 * Props shared by glyph renderers (candlesticks, box plots, dumbbells): the style, with the width of a glyph, and the orientation.
 */
export interface D3PGlyphProps {
  /** The style: the width of a glyph (`barWidth`). */
  style: D3PRendererStyleBase & {
    /** Width of a glyph. Band axis: fraction of the band (default 0.7). Otherwise pixels (default: from the spacing of the points). */
    barWidth?: number
  }
  /** `vertical`: categories along X, values along Y. `horizontal`: the other way round. */
  orientation: 'vertical' | 'horizontal'
}

/** What a glyph needs to draw one point, in pixels. */
export interface D3PGlyphContext {
  /** Position of the middle of the point along the category axis. */
  center: number
  /** Half of the width the glyph may take. */
  half: number
  /** Position of a value along the value axis. */
  at(value: number): number
  /** Pixel coordinates of (category position, value position), whatever the orientation. */
  xy(category: number, position: number): [number, number]
  /** Whether the glyph is drawn horizontally: the categories are along Y. */
  readonly horizontal: boolean
}

interface GlyphData {
  group: Sel
}

/**
 * Base of the renderers that draw a small figure per point out of several columns (a candle, a
 * box, a dumbbell). Subclasses list the columns they need and draw one point; the base finds the
 * position and the width, handles orientation, and rebuilds the figures when the scales change.
 * They draw in cartesian systems.
 */
export abstract class D3PGlyphRenderer<P extends D3PGlyphProps> extends D3PSeriesRenderer<P, GlyphData> {
  protected override readonly systemKinds = ['cartesian'] as const

  /** Columns that must hold a number for a point to be drawn (default: the required columns). */
  protected valueColumns(): readonly string[] {
    return this.requiredColumns
  }

  /** Draw one point into `g`. */
  protected abstract drawGlyph(g: Sel, ctx: D3PGlyphContext, row: D3PPoint, index: (column: string) => number): void

  override getAxes(chart: D3PChart): { x?: D3PAxis; y?: D3PAxis } {
    const axes = super.getAxes(chart)
    return this.props.orientation === 'horizontal' ? { x: axes.y, y: axes.x } : axes
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): GlyphData {
    return { group: undefined as never }
  }
  protected chartAdded(chart: D3PChart, data: GlyphData): void {
    data.group = this.createGroup(chart)
  }
  protected chartRemoved(_chart: D3PChart, data: GlyphData): void {
    data.group.interrupt().remove()
  }

  private halfWidth(sCat: D3PScale, centers: number[]): number {
    const w = this.props.style.barWidth
    if (d3pIsBand(sCat)) return ((sCat as any).bandwidth() * (w ?? 0.7)) / 2
    if (w !== undefined) return w / 2
    const sorted = [...centers].sort((a, b) => a - b)
    let gap = Infinity
    for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i] - sorted[i - 1])
    return Number.isFinite(gap) ? Math.min(20, Math.max(1, gap * 0.35)) : 8
  }

  protected renderData(chart: D3PChart, data: GlyphData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return void data.group.selectAll('*').remove()
    const { sx: sCat, sy: sVal } = scales
    const horizontal = x!.component === 'y'
    const series = this.series
    const idx = (c: string) => series.index(c)
    const cols = this.valueColumns().map(idx)

    // place the points that have everything they need
    const rows: { row: D3PPoint; center: number }[] = []
    for (const row of series.data) {
      const c = d3pIsBand(sCat) ? ((sCat as any)(row[0]) as number | undefined) : ((sCat as any)(row[0]) as number)
      if (c === undefined || !Number.isFinite(c)) continue
      if (cols.some((k) => !Number.isFinite((sVal as any)(row[k])))) continue
      rows.push({ row, center: d3pIsBand(sCat) ? c + (sCat as any).bandwidth() / 2 : c })
    }
    const half = this.halfWidth(sCat, rows.map((r) => r.center))
    const at = (v: number) => (sVal as any)(v) as number
    const xy = (cat: number, pos: number): [number, number] => (horizontal ? [pos, cat] : [cat, pos])

    data.group.interrupt().attr('opacity', 1)
    data.group
      .selectAll<SVGGElement, (typeof rows)[number]>('g.glyph')
      .data(rows)
      .join('g')
      .attr('class', 'glyph')
      .each((d, i, nodes) => {
        const g = d3.select(nodes[i]) as Sel
        g.selectAll('*').remove()
        this.drawGlyph(g, { center: d.center, half, at, xy, horizontal }, d.row, idx)
      })
  }

  protected renderDataWithTransition(chart: D3PChart, data: GlyphData, x?: D3PAxis, y?: D3PAxis): void {
    this.renderData(chart, data, x, y)
    // figures are rebuilt from scratch, so they fade in rather than grow
    data.group.attr('opacity', 0).transition().duration(D3P_TRANSITION_MS).attr('opacity', 1)
  }

  protected renderDataHidden(_chart: D3PChart, data: GlyphData): void {
    data.group
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attr('opacity', 0)
      .on('end', () => data.group.selectAll('*').remove())
  }
}

// ---------------------------------------------------------------------------
// Candlestick
// ---------------------------------------------------------------------------

/**
 * Props of a candlestick chart: the props of a glyph, and in the style the colors of rising and falling candles, the width of the wicks and whether rising candles are hollow.
 */
export interface D3PCandlestickProps extends D3PGlyphProps {
  /**
   * The style: the colors of rising and falling candles, the wicks, and whether rising candles are hollow.
   */
  style: D3PGlyphProps['style'] & {
    /** Color of candles that closed at or above their open, and of those that closed below. */
    upColor: string
    downColor: string
    wickWidth: number
    /** Draw rising candles as outlines. */
    hollowUp: boolean
  }
}

/**
 * Candlesticks: for each point a wick from `low` to `high` and a body from `open` to `close`,
 * colored by direction. The series needs the columns `open`, `high`, `low` and `close` (declare
 * them with `columns`, and `primary: 'close'`).
 */
export class D3PCandlestickRenderer extends D3PGlyphRenderer<D3PCandlestickProps> {
  protected override readonly requiredColumns = ['open', 'high', 'low', 'close'] as const

  constructor(opts: D3PSeriesRendererOptions<D3PCandlestickProps>) {
    super(opts, {
      style: { color: '', barWidth: undefined, upColor: '#26a69a', downColor: '#ef5350', wickWidth: 1, hollowUp: false },
      orientation: 'vertical',
    })
    // the tooltip's dot and the legend take the color of rising candles
    if (opts.props?.style?.color === undefined) this.props({ style: { color: this.props.style.upColor } })
  }

  override legendEntries(): D3PLegendItem[] {
    return super.legendEntries().map((e) => ({ ...e, color: this.props.style.upColor }))
  }

  protected drawGlyph(g: Sel, c: D3PGlyphContext, row: D3PPoint, idx: (name: string) => number): void {
    const { upColor, downColor, wickWidth, hollowUp } = this.props.style
    const [open, high, low, close] = ['open', 'high', 'low', 'close'].map((k) => c.at(row[idx(k)]))
    const up = row[idx('close')] >= row[idx('open')]
    const color = up ? upColor : downColor
    const [wx1, wy1] = c.xy(c.center, low)
    const [wx2, wy2] = c.xy(c.center, high)
    g.append('line').attr('class', 'wick').attr('x1', wx1).attr('y1', wy1).attr('x2', wx2).attr('y2', wy2).attr('stroke', color).attr('stroke-width', wickWidth)
    const [bx1, by1] = c.xy(c.center - c.half, open)
    const [bx2, by2] = c.xy(c.center + c.half, close)
    const minSize = 1
    const w = Math.max(minSize, Math.abs(bx2 - bx1))
    const h = Math.max(minSize, Math.abs(by2 - by1))
    g.append('rect')
      .attr('class', up ? 'body up' : 'body down')
      .attr('x', Math.min(bx1, bx2))
      .attr('y', Math.min(by1, by2))
      .attr('width', w)
      .attr('height', h)
      .attr('fill', up && hollowUp ? 'none' : color)
      .attr('stroke', color)
      .attr('stroke-width', wickWidth)
  }
}

// ---------------------------------------------------------------------------
// Box plot
// ---------------------------------------------------------------------------

/**
 * Props of a box plot: the props of a glyph, and in the style the opacity of the fill, the stroke width and the radius of the outliers.
 */
export interface D3PBoxPlotProps extends D3PGlyphProps {
  /** The style: the fill opacity, the stroke width and the radius of the outliers. */
  style: D3PGlyphProps['style'] & {
    fillOpacity: number
    strokeWidth: number
    /** Radius of the outlier dots. */
    outlierRadius: number
  }
}

/**
 * Box plots: whiskers from `min` to `max`, a box from `q1` to `q3`, a line at the `median`, and
 * the dots of an optional `outliers` column (an array of numbers per point). `d3pBoxPlotRows`
 * computes these columns from raw samples.
 */
export class D3PBoxPlotRenderer extends D3PGlyphRenderer<D3PBoxPlotProps> {
  protected override readonly requiredColumns = ['min', 'q1', 'median', 'q3', 'max'] as const

  constructor(opts: D3PSeriesRendererOptions<D3PBoxPlotProps>) {
    super(opts, { style: { color: '', barWidth: undefined, fillOpacity: 0.35, strokeWidth: 1.5, outlierRadius: 2.5 }, orientation: 'vertical' })
  }

  protected drawGlyph(g: Sel, c: D3PGlyphContext, row: D3PPoint, idx: (name: string) => number): void {
    const { strokeWidth, fillOpacity, outlierRadius } = this.props.style
    const color = this.color
    const v = (name: string) => c.at(row[idx(name)])
    const seg = (c1: number, p1: number, c2: number, p2: number, cls: string) => {
      const [x1, y1] = c.xy(c1, p1)
      const [x2, y2] = c.xy(c2, p2)
      g.append('line').attr('class', cls).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', color).attr('stroke-width', strokeWidth)
    }
    const cap = c.half / 2
    seg(c.center, v('min'), c.center, v('q1'), 'whisker')
    seg(c.center, v('q3'), c.center, v('max'), 'whisker')
    seg(c.center - cap, v('min'), c.center + cap, v('min'), 'cap')
    seg(c.center - cap, v('max'), c.center + cap, v('max'), 'cap')
    const [x1, y1] = c.xy(c.center - c.half, v('q3'))
    const [x2, y2] = c.xy(c.center + c.half, v('q1'))
    g.append('rect')
      .attr('class', 'box')
      .attr('x', Math.min(x1, x2))
      .attr('y', Math.min(y1, y2))
      .attr('width', Math.abs(x2 - x1))
      .attr('height', Math.abs(y2 - y1))
      .attr('fill', color)
      .attr('fill-opacity', fillOpacity)
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
    seg(c.center - c.half, v('median'), c.center + c.half, v('median'), 'median')
    const outliers = idx('outliers') >= 0 ? row[idx('outliers')] : undefined
    if (Array.isArray(outliers)) {
      for (const o of outliers) {
        const [cx, cy] = c.xy(c.center, c.at(o))
        if (Number.isFinite(cx) && Number.isFinite(cy)) g.append('circle').attr('class', 'outlier').attr('cx', cx).attr('cy', cy).attr('r', outlierRadius).attr('fill', 'none').attr('stroke', color)
      }
    }
  }
}

/** The columns of a box plot series, in the order of `d3pBoxPlotRows`. */
export const D3P_BOXPLOT_COLUMNS = ['x', 'min', 'q1', 'median', 'q3', 'max', 'outliers'] as const

/**
 * Box plot rows from raw samples, one per category: quartiles, whiskers at the most extreme
 * sample within 1.5 interquartile ranges of the box, and the samples beyond as outliers.
 * Use them with `columns: D3P_BOXPLOT_COLUMNS`.
 */
export function d3pBoxPlotRows(groups: Iterable<readonly [category: string | number | Date, samples: Iterable<number>]>): [any, number, number, number, number, number, number[]][] {
  const rows: [any, number, number, number, number, number, number[]][] = []
  for (const [category, samples] of groups) {
    const v = [...samples].filter(Number.isFinite).sort(d3.ascending)
    if (!v.length) continue
    const q1 = d3.quantileSorted(v, 0.25)!
    const median = d3.quantileSorted(v, 0.5)!
    const q3 = d3.quantileSorted(v, 0.75)!
    const iqr = q3 - q1
    const inside = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr)
    rows.push([category, inside[0], q1, median, q3, inside[inside.length - 1], v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr)])
  }
  return rows
}

// ---------------------------------------------------------------------------
// Dumbbell
// ---------------------------------------------------------------------------

/**
 * Props of a dumbbell chart: the props of a glyph, and in the style the colors of the two ends and of the line, its width and the radius of the ends.
 */
export interface D3PDumbbellProps extends D3PGlyphProps {
  /** The style: the colors of the two ends and of the line, its width and the radius of the ends. */
  style: D3PGlyphProps['style'] & {
    startColor: string
    endColor: string
    /** Color of the line between the dots. */
    lineColor: string
    lineWidth: number
    radius: number
  }
}

/** Dumbbells: a dot at `start`, a dot at `end`, and a line between them. Needs both columns. */
export class D3PDumbbellRenderer extends D3PGlyphRenderer<D3PDumbbellProps> {
  protected override readonly requiredColumns = ['start', 'end'] as const

  constructor(opts: D3PSeriesRendererOptions<D3PDumbbellProps>) {
    super(opts, { style: { color: '', barWidth: undefined, startColor: '#4e79a7', endColor: '#e15759', lineColor: '#bbb', lineWidth: 3, radius: 5 }, orientation: 'vertical' })
    if (opts.props?.style?.color === undefined) this.props({ style: { color: this.props.style.endColor } }) // the tooltip's dot
  }

  protected drawGlyph(g: Sel, c: D3PGlyphContext, row: D3PPoint, idx: (name: string) => number): void {
    const { startColor, endColor, lineColor, lineWidth, radius } = this.props.style
    const [x1, y1] = c.xy(c.center, c.at(row[idx('start')]))
    const [x2, y2] = c.xy(c.center, c.at(row[idx('end')]))
    g.append('line').attr('class', 'link').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', lineColor).attr('stroke-width', lineWidth)
    g.append('circle').attr('class', 'start').attr('cx', x1).attr('cy', y1).attr('r', radius).attr('fill', startColor)
    g.append('circle').attr('class', 'end').attr('cx', x2).attr('cy', y2).attr('r', radius).attr('fill', endColor)
  }
}
