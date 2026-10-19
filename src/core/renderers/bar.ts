import * as d3 from 'd3'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem, D3PJoinGroup } from '../coords'
import { D3PCellMarker, type D3PMarker } from '../marker'
import type { D3PPointerEvent } from '../pointer'
import type { D3PProbeHit } from '../probe'
import { d3pIsBand, type D3PScale } from '../util'
import { D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PRendererStyleBase, type D3PSeriesRendererOptions } from './base'

/**
 * Props of bars: the style, how many series share a band (`count`, `index`), the orientation and the column the bars start from (`base`).
 */
export interface D3PBarProps {
  /**
   * The style: the color, the width of the bars, their offset in the band and the margin between them, and the shape (`bar` or `lollipop`).
   */
  style: D3PRendererStyleBase & {
    /**
     * Width of a bar. Band axis: fraction of the band (default 0.9). Bins (`x0`/`x1` columns):
     * fraction of the bin (default 0.95). Otherwise in range units: pixels on a cartesian X axis,
     * radians on a polar angle (default 20).
     */
    barWidth?: number
    /** Shift of the bar along the category axis (continuous: range units; band: fraction of the band). */
    offset: number
    /** Fraction of the bar slot left empty between grouped bars (band axis). */
    margin: number
    /** `bar`: a filled cell; `lollipop`: a stem with a dot at the end. */
    shape: 'bar' | 'lollipop'
    /** Dot radius and stem width of a lollipop, in pixels. */
    headRadius: number
    stemWidth: number
    /** Color of the bars whose value is below their base. */
    negativeColor?: string
    /** Column whose value picks the color in `colors` (a waterfall's `kind`). */
    colorBy?: string
    colors?: Record<string, string>
  }
  /** Number of bar series side by side (band axis). */
  count: number
  /** 1-based index of this series among the grouped ones (band axis). */
  index: number
  /**
   * `vertical`: the series' `x` is on the first dimension (columns; polar: a rose). `horizontal`:
   * it is on the second one (bars; polar: radial bars) and the value on the first.
   */
  orientation: 'vertical' | 'horizontal'
  /**
   * Column holding the base of each bar: a range, a layer of a stack, a waterfall step. Default:
   * the `y0` column when the series has one, else the zero line.
   */
  base?: string
}

/** A bar as a cell of the coordinate system: first dimension `a0..a1`, second `b0..b1`, in range units. */
interface Cell {
  a0: number
  a1: number
  b0: number
  b1: number
  color: string
  /** Index of the data point. */
  index: number
  /** The x value of the data point: what the bar is paired by when the data changes. */
  key: string
}

interface BarData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  /** Tag of the elements currently drawn (`rect` in cartesian, `path` otherwise, `g` for lollipops). */
  tag?: string
}

const DEFAULT_KIND_COLORS: Record<string, string> = { up: '#2ca02c', down: '#d62728', total: '#7f7f7f' }

/**
 * Bars in any coordinate system: rectangles in a cartesian one, arcs in a polar one (a rose when
 * the series' `x` is the angle, radial bars when it is the radius). They can start from a base
 * column (ranges, stacks, waterfalls), take their width from bin edges (histograms), and be
 * horizontal.
 */
export class D3PBarRenderer extends D3PSeriesRenderer<D3PBarProps, BarData> {
  private readonly shown = new WeakMap<Element, Cell>()

  constructor(opts: D3PSeriesRendererOptions<D3PBarProps>) {
    super(opts, {
      style: { color: '', barWidth: undefined, offset: 0, margin: 0, shape: 'bar', headRadius: 5, stemWidth: 2 },
      count: 1,
      index: 1,
      orientation: 'vertical',
    })
  }

  override createMarker(): D3PMarker {
    return new D3PCellMarker()
  }

  override probeHit(chart: D3PChart, event: D3PPointerEvent, joins: readonly D3PJoinGroup[] = []): D3PProbeHit | undefined {
    const hit = super.probeHit(chart, event, joins)
    if (!hit || hit.index === undefined) return hit
    const { x, y } = this.getAxes(chart)
    const sx = x?.getScale(chart)
    const sy = y?.getScale(chart)
    if (!x || !sx || !sy) return hit
    const cell = this.cells(sx, sy, x.component === 'y').find((c) => c.index === hit.index)
    if (cell) hit.cell = { a0: cell.a0, a1: cell.a1, b0: cell.b0, b1: cell.b1 }
    return hit
  }

  override getAxes(chart: D3PChart): { x?: D3PAxis; y?: D3PAxis } {
    const axes = super.getAxes(chart)
    return this.props.orientation === 'horizontal' ? { x: axes.y, y: axes.x } : axes
  }

  protected override checkColumns(series = this.series): void {
    super.checkColumns(series)
    for (const c of [this.props.base, this.props.style.colorBy]) {
      if (c !== undefined && !series.has(c)) {
        throw new Error(`[d3pict] renderer "${this.name}": series "${series.name}" has no column "${c}" (columns: ${series.columns.join(', ')})`)
      }
    }
  }

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): BarData {
    return { group: undefined as never }
  }
  protected chartAdded(chart: D3PChart, data: BarData): void {
    data.group = this.createGroup(chart)
  }
  protected chartRemoved(_chart: D3PChart, data: BarData): void {
    data.group.interrupt().remove()
  }

  // ----- geometry -----

  private colorOf(p: ArrayLike<any>, base: number | undefined): string {
    const { style } = this.props
    if (style.colorBy !== undefined) {
      const kind = String(p[this.series.index(style.colorBy)])
      return style.colors?.[kind] ?? (style.colorBy === 'kind' ? DEFAULT_KIND_COLORS[kind] : undefined) ?? this.color
    }
    if (style.negativeColor && p[1] < (base ?? 0)) return style.negativeColor
    return this.color
  }

  private cells(sCat: D3PScale, sVal: D3PScale, swapped: boolean): Cell[] {
    const { style, count, index, base: baseName } = this.props
    const series = this.series
    const baseName2 = baseName ?? (series.has('y0') ? 'y0' : undefined)
    const baseIdx = baseName2 === undefined ? undefined : series.index(baseName2)
    const zero = (sVal as any)(0) as number
    const zeroLine = Number.isFinite(zero) ? zero : (sVal as any).range()[0]
    const band = d3pIsBand(sCat)
    const x0i = series.index('x0')
    const x1i = series.index('x1')
    const out: Cell[] = []
    for (const [row, p] of series.data.entries()) {
      const v1 = (sVal as any)(p[1]) as number
      const baseValue = baseIdx === undefined ? undefined : (p[baseIdx] as number)
      const v0 = baseValue === undefined ? zeroLine : ((sVal as any)(baseValue) as number)
      if (!Number.isFinite(v1) || !Number.isFinite(v0)) continue
      let c0: number
      let c1: number
      if (band) {
        const start = (sCat as any)(p[0]) as number | undefined
        if (start === undefined) continue
        const bw = (sCat as any).bandwidth() as number
        const total = bw * (style.barWidth ?? 0.9)
        const marginPx = total * style.margin
        const slot = total / count
        c0 = start + (bw - total) / 2 + (index - 1) * slot + marginPx / 2 + style.offset * bw
        c1 = c0 + Math.max(0, slot - marginPx)
      } else if (x0i >= 0 && x1i >= 0) {
        const a = (sCat as any)(p[x0i]) as number
        const b = (sCat as any)(p[x1i]) as number
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue
        const half = (Math.abs(b - a) * (style.barWidth ?? 0.95)) / 2
        c0 = (a + b) / 2 - half
        c1 = (a + b) / 2 + half
      } else {
        const at = (sCat as any)(p[0]) as number
        if (!Number.isFinite(at)) continue
        const w = style.barWidth ?? 20
        c0 = at + style.offset - w / 2
        c1 = at + style.offset + w / 2
      }
      const color = this.colorOf(p, baseValue)
      const key = p[0] instanceof Date ? String(p[0].getTime()) : String(p[0])
      out.push(swapped ? { a0: v0, a1: v1, b0: c0, b1: c1, color, index: row, key } : { a0: c0, a1: c1, b0: v0, b1: v1, color, index: row, key })
    }
    return out
  }

  /** The cell with no value (the bar at its base): where bars grow from and shrink to. */
  private collapsed(c: Cell, swapped: boolean): Cell {
    return swapped ? { ...c, a1: c.a0 } : { ...c, b1: c.b0 }
  }

  // ----- drawing -----

  private apply(chart: D3PChart, system: D3PCoordinateSystem, el: Element, c: Cell) {
    const node = d3.select(el)
    if (this.props.style.shape === 'lollipop') {
      const mid = (c.a0 + c.a1) / 2
      const mid2 = (c.b0 + c.b1) / 2
      const swapped = this.props.orientation === 'horizontal'
      // the stem runs along the value dimension, through the middle of the category slot
      const from = swapped ? system.projectTo(chart, c.a0, mid2) : system.projectTo(chart, mid, c.b0)
      const to = swapped ? system.projectTo(chart, c.a1, mid2) : system.projectTo(chart, mid, c.b1)
      node.select('line').attr('x1', from.x).attr('y1', from.y).attr('x2', to.x).attr('y2', to.y)
      node.select('circle').attr('cx', to.x).attr('cy', to.y)
      return
    }
    const shape = system.cellShape(chart, c.a0, c.a1, c.b0, c.b1)
    if (shape.tag === 'rect') node.attr('x', shape.x).attr('y', shape.y).attr('width', shape.width).attr('height', shape.height)
    else node.attr('d', shape.d).attr('transform', shape.transform ?? null)
  }

  private paint(el: Element, c: Cell) {
    const node = d3.select(el)
    const { shape, headRadius, stemWidth } = this.props.style
    if (shape === 'lollipop') {
      node.select('line').attr('stroke', c.color).attr('stroke-width', stemWidth)
      node.select('circle').attr('fill', c.color).attr('r', headRadius)
    } else node.attr('fill', c.color)
  }

  private draw(chart: D3PChart, data: BarData, x: D3PAxis | undefined, y: D3PAxis | undefined, mode: 'set' | 'tween' | 'hide') {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return void data.group.interrupt().selectAll('*').remove()
    const swapped = x!.component === 'y'
    const { system } = scales
    const lollipop = this.props.style.shape === 'lollipop'
    const tag = lollipop ? 'g' : system.kind === 'cartesian' ? 'rect' : 'path'
    if (data.tag !== tag) {
      data.group.interrupt().selectAll('*').remove()
      data.tag = tag
    }
    const self = this
    const cells = mode === 'hide' ? [] : this.cells(scales.sx, scales.sy, swapped)
    const grow = (d: Cell) => self.collapsed(d, swapped)
    const tween = (el: Element, to: Cell) => {
      const from = self.shown.get(el) ?? to
      const i = d3.interpolateObject(from, to) as (t: number) => Cell
      return (t: number) => {
        const c = { ...i(t), color: to.color }
        self.shown.set(el, c)
        self.apply(chart, system, el, c)
      }
    }
    const jitter = (sel: d3.Selection<any, Cell, any, any>) => sel.attr('class', 'bar').each(function (d) { self.paint(this, d) })

    const joined = data.group.selectAll<SVGElement, Cell>(`${tag}.bar`).data(cells, (d) => d.key)
    const merged = joined.join(
      (enter) =>
        jitter(
          enter.append((_d, _i, _g) => {
            const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
            if (lollipop) {
              el.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line'))
              el.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'circle'))
            }
            return el
          }),
        ).each(function (d) {
          // new bars grow from their base
          const start = mode === 'tween' ? grow(d) : d
          self.shown.set(this, start)
          self.apply(chart, system, this, start)
        }),
      (update) => update,
      (exit) => {
        if (mode === 'tween') {
          exit
            .transition()
            .duration(D3P_TRANSITION_MS)
            .tween('cell', function () {
              const from = self.shown.get(this)
              return from ? tween(this, grow(from)) : () => {}
            })
            .remove()
        } else exit.interrupt().remove()
        return exit
      },
    )
    merged.each(function (d) {
      self.paint(this, d)
    })
    if (mode === 'tween') {
      merged.interrupt().transition().duration(D3P_TRANSITION_MS).tween('cell', function (d) { return tween(this, d) })
    } else if (mode === 'set') {
      merged.interrupt().each(function (d) {
        self.shown.set(this, d)
        self.apply(chart, system, this, d)
      })
    }
  }

  protected renderData(chart: D3PChart, data: BarData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y, 'set')
  }
  protected renderDataWithTransition(chart: D3PChart, data: BarData, x?: D3PAxis, y?: D3PAxis): void {
    this.draw(chart, data, x, y, 'tween')
  }

  protected renderDataHidden(chart: D3PChart, data: BarData, x?: D3PAxis, y?: D3PAxis): void {
    const scales = this.scalesOf(chart, x, y)
    if (!scales) return void data.group.interrupt().selectAll('*').remove()
    const swapped = x!.component === 'y'
    const self = this
    data.group
      .selectAll<SVGElement, Cell>('.bar')
      .transition()
      .duration(D3P_TRANSITION_MS)
      .tween('cell', function () {
        const from = self.shown.get(this)
        if (!from) return () => {}
        const to = self.collapsed(from, swapped)
        const i = d3.interpolateObject(from, to) as (t: number) => Cell
        return (t) => {
          const c = { ...i(t), color: from.color }
          self.shown.set(this, c)
          self.apply(chart, scales.system, this, c)
        }
      })
      .remove()
  }
}
