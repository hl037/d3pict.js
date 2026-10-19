import * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions, D3PUnsubscribe } from './bus'
import type { D3PAxis } from './axis'
import type { D3PChart } from './chart'
import type { D3PCoordinateSystem } from './coords'
import { D3PAttachable } from './object'
import { d3pScaleProjectTo, type D3PDomainValue } from './util'

/**
 * Annotations: marks tied to values of the axes rather than to pixels, so they follow zooms,
 * pans and resizes, in cartesian and polar systems alike. They are attachable objects like any
 * other and never take the pointer.
 */

export type D3PAxisRef = D3PAxis | string

/** The style of an annotation: stroke, fill, opacity and the color and size of its label. */
export interface D3PAnnotationStyle {
  /** Color of the line or of the outline. */
  stroke: string
  /** Width of the line, in pixels. */
  strokeWidth: number
  /** Dash of the line, as an SVG `stroke-dasharray` (solid by default). */
  strokeDasharray: string
  /** Fill of a band or a marker. */
  fill: string
  /** Opacity of the mark, from 0 to 1. */
  opacity: number
  /** Color and size of the label. */
  color: string
  /** Size of the label, in pixels. */
  fontSize: number
}

const DEFAULT_STYLE: D3PAnnotationStyle = { stroke: '#d62728', strokeWidth: 1.5, strokeDasharray: '', fill: '#d62728', opacity: 1, color: 'currentColor', fontSize: 11 }

interface AnnotationData {
  group: d3.Selection<SVGGElement, unknown, null, undefined>
  watched: Map<D3PAxis, D3PUnsubscribe>
}

/** Options shared by the annotations: the label, the style and the bus. */
export interface D3PAnnotationOptions {
  /** The bus the annotation uses (the global bus by default). */
  bus?: D3PBus
  /** The text written next to the mark. */
  label?: string
  /** The style of the marks. */
  style?: Partial<D3PAnnotationStyle>
}

abstract class D3PAnnotation extends D3PAttachable<AnnotationData> {
  /** The style of the marks. */
  style: D3PAnnotationStyle
  /** The text written next to the mark. */
  label: string | undefined
  /** Layer the marks go in: `background` (behind the axes and data) or `annotation` (above the data). */
  protected abstract readonly behind: boolean

  constructor(kind: string, opts: D3PAnnotationOptions) {
    super(`annotation[${kind}]`, [], opts.bus)
    this.style = { ...DEFAULT_STYLE, ...opts.style }
    this.label = opts.label
  }

  protected createData(chart: D3PChart): AnnotationData {
    const parent = this.behind ? chart.layer.background : chart.layer.annotation.middle
    return { group: parent.append('g').attr('class', 'annotation').style('pointer-events', 'none'), watched: new Map() }
  }

  protected attached(chart: D3PChart, data: AnnotationData, subs: D3PSubscriptions): void {
    const redraw = () => this.tagDirty(chart)
    // follow the scale of every axis of the chart: the one a mark refers to may come and go
    const watch = () => {
      const state = chart.axes.getAxesState()
      for (const a of [...state.x, ...state.y]) if (!data.watched.has(a)) data.watched.set(a, this.bus.on(a.e.scaleChanged, (p) => p.chart === chart && redraw()))
      for (const [a, off] of data.watched) {
        if (![...state.x, ...state.y].includes(a)) (off(), data.watched.delete(a))
      }
      redraw()
    }
    subs.add(this.bus.on(chart.axes.e.axesListChanged, watch))
    subs.add(this.bus.on(chart.e.resized, redraw))
    watch()
  }

  protected override detached(_chart: D3PChart, data: AnnotationData): void {
    for (const off of data.watched.values()) off()
    data.watched.clear()
    data.group.remove()
  }

  /** The axis of a reference: the axis object, or the axis of that name on the chart. */
  protected axisOf(chart: D3PChart, ref: D3PAxisRef): D3PAxis | undefined {
    const state = chart.axes.getAxesState()
    return [...state.x, ...state.y].find((a) => (typeof ref === 'string' ? a.name === ref : a === ref))
  }

  /** Position of `value` along `axis`, in range units. */
  protected position(chart: D3PChart, axis: D3PAxis, value: D3PDomainValue): number | undefined {
    const scale = axis.getScale(chart)
    return scale ? d3pScaleProjectTo(scale, value) : undefined
  }

  /** Whether a position along an axis is on the axis (a mark outside it is not drawn, and has no label). */
  protected within(chart: D3PChart, axis: D3PAxis, position: number): boolean {
    const range = (axis.getScale(chart) as any)?.range?.() as number[] | undefined
    if (!range) return true
    const [lo, hi] = [Math.min(...range), Math.max(...range)]
    return position >= lo - 0.5 && position <= hi + 0.5
  }

  /** Writes a label. */
  protected text(group: AnnotationData['group'], text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'start') {
    group.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor).attr('font-size', this.style.fontSize).attr('fill', this.style.color).text(text)
  }

  /** Draws the marks, clipped to the plot, and their labels. */
  override render(chart: D3PChart): void {
    const data = this.chartData.get(chart)
    if (!data || this.isDestroying) return
    data.group.selectAll('*').remove()
    // the marks stop at the edge of the plot; the labels are not cut, and only shown for a mark that is inside
    const system = this.systemOf(chart)
    const shapes = data.group.append('g').attr('clip-path', system?.clipPath(chart) ?? chart.plotClip)
    this.draw(chart, shapes, data.group.append('g'))
  }

  /** The coordinate system the marks are drawn in, to clip them to its shape. */
  protected systemOf(chart: D3PChart): D3PCoordinateSystem | undefined {
    return chart.axes.getAxesState().x[0]?.getSystem(chart)
  }

  /** Draw the marks in `shapes` (clipped to the plot) and their labels in `labels`. */
  protected abstract draw(chart: D3PChart, shapes: AnnotationData['group'], labels: AnnotationData['group']): void
}

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------

/** Options of an annotation line: the axis, and the value it marks. */
export interface D3PAnnotationLineOptions extends D3PAnnotationOptions {
  /** The axis the value is on (object or name). */
  axis: D3PAxisRef
  /** The value the line is at. */
  value: D3PDomainValue
}

/**
 * A line at a value of an axis: a vertical or horizontal line in a cartesian system, a spoke
 * (for an angle) or a circle (for a radius) in a polar one.
 */
export class D3PAnnotationLine extends D3PAnnotation {
  protected readonly behind = false
  /** The axis the line is on. */
  axis: D3PAxisRef
  /** The value the line is at. */
  value: D3PDomainValue

  constructor(opts: D3PAnnotationLineOptions) {
    super('line', opts)
    this.axis = opts.axis
    this.value = opts.value
  }

  protected override systemOf(chart: D3PChart): D3PCoordinateSystem | undefined {
    return this.axisOf(chart, this.axis)?.getSystem(chart)
  }

  protected draw(chart: D3PChart, group: AnnotationData['group'], labels: AnnotationData['group']): void {
    const axis = this.axisOf(chart, this.axis)
    const system = axis?.getSystem(chart)
    const at = axis && this.position(chart, axis, this.value)
    if (!axis || !system || at === undefined || !this.within(chart, axis, at)) return
    const shapes = system.cursor(chart, axis.component === 'x' ? at : undefined, axis.component === 'y' ? at : undefined)
    const g = axis.component === 'x' ? shapes.x : shapes.y
    if (!g) return
    const { stroke, strokeWidth, strokeDasharray, opacity } = this.style
    let mark: d3.Selection<any, unknown, null, undefined>
    if (g.kind === 'line') mark = group.append('line').attr('x1', g.x1).attr('y1', g.y1).attr('x2', g.x2).attr('y2', g.y2)
    else if (g.kind === 'circle') mark = group.append('circle').attr('cx', g.cx).attr('cy', g.cy).attr('r', g.r).attr('fill', 'none')
    else mark = group.append('path').attr('d', g.d).attr('fill', 'none')
    mark.attr('class', 'annotation-line').attr('stroke', stroke).attr('stroke-width', strokeWidth).attr('stroke-dasharray', strokeDasharray || null).attr('opacity', opacity)
    if (this.label) {
      const [x, y, vertical] = g.kind === 'line' ? [g.x1, g.y1, g.x1 === g.x2] : g.kind === 'circle' ? [g.cx + g.r, g.cy, false] : [0, 0, false]
      this.text(labels, this.label, x + 4, vertical ? y + 12 : y - 4)
    }
  }
}

// ---------------------------------------------------------------------------
// Band
// ---------------------------------------------------------------------------

/** Options of an annotation band: the axis, and the two values it covers. */
export interface D3PAnnotationBandOptions extends D3PAnnotationOptions {
  /** The axis the band is on. */
  axis: D3PAxisRef
  /** Where the band starts, as a value of the axis. */
  from: D3PDomainValue
  /** Where the band ends, as a value of the axis. */
  to: D3PDomainValue
}

/** A band between two values of an axis, across the whole chart: a strip, a sector or a ring. */
export class D3PAnnotationBand extends D3PAnnotation {
  protected readonly behind = true
  /** The axis the band is on. */
  axis: D3PAxisRef
  /** Where the band starts, as a value of the axis. */
  from: D3PDomainValue
  /** Where the band ends, as a value of the axis. */
  to: D3PDomainValue

  constructor(opts: D3PAnnotationBandOptions) {
    super('band', { ...opts, style: { fill: '#ffbb00', opacity: 0.18, ...opts.style } })
    this.axis = opts.axis
    this.from = opts.from
    this.to = opts.to
  }

  protected override systemOf(chart: D3PChart): D3PCoordinateSystem | undefined {
    return this.axisOf(chart, this.axis)?.getSystem(chart)
  }

  protected draw(chart: D3PChart, group: AnnotationData['group'], labels: AnnotationData['group']): void {
    const axis = this.axisOf(chart, this.axis)
    const system = axis?.getSystem(chart)
    if (!axis || !system) return
    let p = this.position(chart, axis, this.from)
    let q = this.position(chart, axis, this.to)
    if (p === undefined || q === undefined) return
    // a band scale gives the start of a category: cover the whole of the last one
    const scale = axis.getScale(chart) as any
    if (scale?.bandwidth && scale.bandwidth() > 0) {
      p -= scale.bandwidth() / 2
      q += scale.bandwidth() / 2
    }
    const full = system.ranges(chart)[axis.component === 'x' ? 'y' : 'x']
    const cell = axis.component === 'x' ? system.cellShape(chart, p, q, full[0], full[1]) : system.cellShape(chart, full[0], full[1], p, q)
    const { fill, opacity } = this.style
    const mark: d3.Selection<any, unknown, null, undefined> =
      cell.tag === 'rect' ? group.append('rect').attr('x', cell.x).attr('y', cell.y).attr('width', cell.width).attr('height', cell.height) : group.append('path').attr('d', cell.d).attr('transform', cell.transform ?? null)
    mark.attr('class', 'annotation-band').attr('fill', fill).attr('opacity', opacity)
    if (this.label && this.within(chart, axis, (p + q) / 2)) {
      const at = axis.component === 'x' ? system.projectTo(chart, (p + q) / 2, full[1]) : system.projectTo(chart, full[0], (p + q) / 2)
      this.text(labels, this.label, at.x, at.y + 12, 'middle')
    }
  }
}

// ---------------------------------------------------------------------------
// Point
// ---------------------------------------------------------------------------

/** Options of an annotation point: the axes, the values and the radius of the mark. */
export interface D3PAnnotationPointOptions extends D3PAnnotationOptions {
  /** Axes of the point; default: the first X axis and the first Y axis of the chart. */
  xAxis?: D3PAxisRef
  /** The Y axis of the point (the first one of the same system by default). */
  yAxis?: D3PAxisRef
  /** The value on the X axis. */
  x: D3PDomainValue
  /** The value on the Y axis. */
  y: D3PDomainValue
  /** Radius of the mark, in pixels (5 by default). */
  radius?: number
}

/** A marker at a point of the axes, with an optional label beside it. */
export class D3PAnnotationPoint extends D3PAnnotation {
  protected readonly behind = false
  /** The X axis of the point (the first of the chart by default). */
  xAxis: D3PAxisRef | undefined
  /** The Y axis of the point. */
  yAxis: D3PAxisRef | undefined
  /** The value on the X axis. */
  x: D3PDomainValue
  /** The value on the Y axis. */
  y: D3PDomainValue
  /** Radius of the mark, in pixels. */
  radius: number

  constructor(opts: D3PAnnotationPointOptions) {
    super('point', opts)
    this.xAxis = opts.xAxis
    this.yAxis = opts.yAxis
    this.x = opts.x
    this.y = opts.y
    this.radius = opts.radius ?? 5
  }

  protected override systemOf(chart: D3PChart): D3PCoordinateSystem | undefined {
    const state = chart.axes.getAxesState()
    return (this.xAxis !== undefined ? this.axisOf(chart, this.xAxis) : state.x[0])?.getSystem(chart)
  }

  protected draw(chart: D3PChart, group: AnnotationData['group'], labels: AnnotationData['group']): void {
    const state = chart.axes.getAxesState()
    const ax = this.xAxis !== undefined ? this.axisOf(chart, this.xAxis) : state.x[0]
    const ay = this.yAxis !== undefined ? this.axisOf(chart, this.yAxis) : state.y.find((a) => a.getSystem(chart) === ax?.getSystem(chart))
    const system = ax?.getSystem(chart)
    if (!ax || !ay || !system || ay.getSystem(chart) !== system) return
    const a = this.position(chart, ax, this.x)
    const b = this.position(chart, ay, this.y)
    if (a === undefined || b === undefined) return
    const at = ax.component === 'x' ? system.projectTo(chart, a, b) : system.projectTo(chart, b, a)
    const { x: px, y: py } = at
    const { fill, stroke, strokeWidth, opacity } = this.style
    group.append('circle').attr('class', 'annotation-point').attr('cx', px).attr('cy', py).attr('r', this.radius).attr('fill', fill).attr('stroke', stroke).attr('stroke-width', strokeWidth).attr('opacity', opacity)
    if (this.label && this.within(chart, ax, a) && this.within(chart, ay, b)) this.text(labels, this.label, px + this.radius + 4, py + 4)
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Options of an annotation text: the text, where it goes, its offset and its anchor. */
export interface D3PAnnotationTextOptions extends D3PAnnotationOptions {
  /** The text to write. */
  text: string
  /**
   * Where the text is centered: the center of the polar system with that name (the middle of a
   * gauge), or, as a pair of fractions, a point of the inner area (`[0.5, 0.5]` is its middle).
   */
  at?: string | [number, number]
  /** Offset in pixels from that place. */
  dx?: number
  /** Offset of the text from its place, in pixels, on y. */
  dy?: number
  /** Which side of its position the text starts from: `start`, `middle` (the default) or `end`. */
  anchor?: 'start' | 'middle' | 'end'
}

/** A piece of text at a place that does not depend on the axes: the center of a gauge, a corner... */
export class D3PAnnotationText extends D3PAnnotation {
  protected readonly behind = false
  /** The text to write. */
  text_: string
  /** Where the text is centered: the name of a polar system, or fractions of the plot. */
  at: string | [number, number]
  /** Offset of the text from its place, in pixels, on x. */
  dx: number
  /** Offset of the text from its place, in pixels, on y. */
  dy: number
  /** Which side of its position the text starts from. */
  anchor: 'start' | 'middle' | 'end'

  constructor(opts: D3PAnnotationTextOptions) {
    super('text', { ...opts, style: { fontSize: 24, ...opts.style } })
    this.text_ = opts.text
    this.at = opts.at ?? [0.5, 0.5]
    this.dx = opts.dx ?? 0
    this.dy = opts.dy ?? 0
    this.anchor = opts.anchor ?? 'middle'
  }

  protected override systemOf(): undefined {
    return undefined
  }

  protected draw(chart: D3PChart, _shapes: AnnotationData['group'], group: AnnotationData['group']): void {
    let x: number
    let y: number
    if (typeof this.at === 'string') {
      const system = chart.coords.get(this.at) as unknown as { geometry?(c: D3PChart): { cx: number; cy: number } } | undefined
      const g = system?.geometry?.(chart)
      if (!g) return
      ;[x, y] = [g.cx, g.cy]
    } else [x, y] = [this.at[0] * chart.innerWidth, this.at[1] * chart.innerHeight]
    group
      .append('text')
      .attr('class', 'annotation-text')
      .attr('x', x + this.dx)
      .attr('y', y + this.dy)
      .attr('text-anchor', this.anchor)
      .attr('dominant-baseline', 'central')
      .attr('font-size', this.style.fontSize)
      .attr('fill', this.style.color)
      .text(this.text_)
  }
}
