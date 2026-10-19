import * as d3 from 'd3'
import type { D3PSubscriptions } from '../bus'
import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PPolarGeometry, D3PPolarSystem } from '../coords'
import { D3PFunctionMarker, type D3PMarker } from '../marker'
import type { D3PPointerEvent } from '../pointer'
import type { D3PProbeHit } from '../probe'
import {
  D3P_TRANSITION_MS, D3PSeriesRenderer, type D3PLegendItem, type D3PRendererChartData, type D3PRendererStyleBase, type D3PSeriesRendererOptions,
} from './base'

/** A slice of a pie: its category, value, share, color and angles. */
export interface D3PPieSlice {
  /** The category (its label); slices sharing a label share their legend entry. */
  key: string
  /** The label of the category. */
  label: string
  /** The value of the category. */
  value: number
  /** Share of the slices currently shown (0 to 1). */
  percent: number
  /** Color of the slice: from `style.colors`, by position. */
  color: string
  /** Screen angles in radians (0 = up, clockwise on a clockwise system). */
  startAngle: number
  /** Angle where the slice ends, in radians. */
  endAngle: number
}

/**
 * Props of a pie: its style, the padding between slices, the corner radius, the order of the slices, the radius, how far a hovered slice moves out (`explode`), whether it reacts to the pointer (`hover`) and the labels.
 */
export interface D3PPieProps {
  /** The style: the colors of the slices (by position, cycled), and the stroke between them. */
  style: D3PRendererStyleBase & {
    /** Slice colors, by position in the data (cycled); default: a categorical palette. */
    colors?: string[]
    stroke: string
    strokeWidth: number
  }
  /** Gap between slices, in degrees. */
  padAngle: number
  /** Radius of the rounded corners of the slices, in pixels. */
  cornerRadius: number
  /** The order of the slices: the order of the data, or by value. */
  sort: 'none' | 'ascending' | 'descending'
  /**
   * Inner and outer radius as fractions of the ring of the polar system (`[0, 1]` fills it).
   * Several pies on one chart can be nested by giving each its own range.
   */
  radius: [number, number]
  /** Pixels by which the hovered slice moves outwards. */
  explode: number
  /** Move the hovered slice (asks for an interaction area). */
  hover: boolean
  /**
   * The labels written on the slices: whether, which slices have one, their color and how they are written.
   */
  labels: {
    enabled: boolean
    /** Slices smaller than this share (0 to 1) get no label. */
    minPercent: number
    /** Color of the labels. */
    color: string
    format?: (slice: D3PPieSlice) => string
  }
}

type Sel = d3.Selection<SVGGElement, unknown, null, undefined>
type ArcState = { startAngle: number; endAngle: number; padAngle: number }

interface PieData {
  group: Sel
  system: D3PPolarSystem
  hovered?: string
}

const TAU = Math.PI * 2

/**
 * A pie (or donut, or ring of a nested pie): one slice per point of the series, `x` being the
 * name of the slice and `y` its size. Values that are not positive numbers have no slice.
 *
 * It has no axes. It draws in a polar coordinate system (the `polar` one by default, or the one
 * named by the `system` option) and takes its center, outer radius, hole (`innerRadius`), start
 * angle and direction from it, so the same system settings shape pies and polar charts.
 *
 * Its legend has one entry per slice, which shows and hides it; its tooltip is answered by
 * testing the pointer against the slices.
 */
export class D3PPieRenderer extends D3PSeriesRenderer<D3PPieProps, PieData> {
  protected override readonly systemKinds = ['polar'] as const
  private readonly hidden = new Set<string>()

  constructor(opts: D3PSeriesRendererOptions<D3PPieProps>) {
    super(opts, {
      style: { color: '', colors: [...d3.schemeCategory10], stroke: '#fff', strokeWidth: 1 },
      padAngle: 0,
      cornerRadius: 0,
      sort: 'none',
      radius: [0, 1],
      explode: 6,
      hover: true,
      labels: { enabled: true, minPercent: 0.04, color: '#fff' },
    })
  }

  // ----- data -----

  /** Every point with a positive size, in data order, with its color. */
  private items() {
    const palette = this.props.style.colors?.length ? this.props.style.colors : d3.schemeCategory10
    return this.series.data
      .map(([x, y], i) => ({ key: String(x), label: String(x), value: y as number, color: palette[i % palette.length] }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
  }

  /** The slices on screen, laid out around the circle of `system` (hidden ones are left out). */
  slices(chart: D3PChart): D3PPieSlice[] {
    const system = this.chartData.get(chart)?.data.system
    return system ? this.layout(system.geometry(chart)) : []
  }

  private layout(g: D3PPolarGeometry): D3PPieSlice[] {
    const shown = this.items().filter((d) => !this.hidden.has(d.key))
    const total = d3.sum(shown, (d) => d.value)
    if (!total) return []
    const { sort, padAngle } = this.props
    const pie = d3
      .pie<(typeof shown)[number]>()
      .value((d) => d.value)
      .startAngle(g.a0)
      .endAngle(g.a0 + g.dir * g.sweep)
      .padAngle((padAngle * Math.PI) / 180)
    pie.sortValues(sort === 'none' ? null : sort === 'ascending' ? (a, b) => a - b : (a, b) => b - a)
    // d3 returns the arcs in data order; present them in the order they appear around the circle
    return pie(shown)
      .map((a) => ({ ...a.data, percent: a.data.value / total, startAngle: a.startAngle, endAngle: a.endAngle }))
      .sort((p, q) => g.dir * (p.startAngle - q.startAngle))
  }

  private radii(g: D3PPolarGeometry): [number, number] {
    const [from, to] = this.props.radius
    const span = g.R - g.r0
    return [g.r0 + span * Math.max(0, Math.min(from, to)), g.r0 + span * Math.min(1, Math.max(from, to))]
  }

  // ----- legend: one entry per slice -----

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

  // ----- no axes -----

  override getAxes(): { x?: D3PAxis; y?: D3PAxis } {
    return {}
  }
  override projectTo(): undefined {
    return undefined
  }
  override projectFrom(): undefined {
    return undefined
  }

  // ----- probe: hit-testing, and the marker that pulls the slice out -----

  override createMarker(): D3PMarker {
    return new D3PFunctionMarker({
      interactive: () => this.props.hover,
      show: (chart, hit) => this.hoverSlice(chart, hit.key),
      hide: (chart) => this.hoverSlice(chart, undefined),
    })
  }

  private hoverSlice(chart: D3PChart, key: string | undefined) {
    const data = this.chartData.get(chart)
    if (!data || !this.props.hover) return
    this.hover(chart, data.data, key)
  }

  private sliceAt(chart: D3PChart, x: number, y: number): D3PPieSlice | undefined {
    const system = this.chartData.get(chart)?.data.system
    if (!system || !this.visible) return undefined
    const g = system.geometry(chart)
    const [ri, ro] = this.radii(g)
    const dx = x - g.cx
    const dy = y - g.cy
    const r = Math.hypot(dx, dy)
    if (r < ri || r > ro) return undefined
    // angle along the sweep of the pie, from its start (0) to the end of the sweep
    const rel = (((g.dir * (Math.atan2(dx, -dy) - g.a0)) % TAU) + TAU) % TAU
    return this.layout(g).find((s) => rel >= g.dir * (s.startAngle - g.a0) && rel < g.dir * (s.endAngle - g.a0))
  }

  override probeHit(chart: D3PChart, event: D3PPointerEvent): D3PProbeHit | undefined {
    if (event.chart !== chart) return undefined // no axes to follow the pointer of another chart through
    const s = this.sliceAt(chart, event.x, event.y)
    const plain = (v: unknown) => String(v)
    return s && { renderer: this, x: s.label, y: s.value, key: s.key, label: s.label, percent: s.percent, color: s.color, xFormatter: plain, yFormatter: plain }
  }

  // ----- attach -----

  /** Creates what the renderer keeps for a chart. */
  protected createRendererData(): PieData {
    return { group: undefined as never, system: undefined as never }
  }

  /** Creates the group the slices are drawn in. */
  protected chartAdded(chart: D3PChart, data: PieData): void {
    const name = this.system ?? 'polar'
    const system = chart.coords.ensure(name, `renderer "${this.name}"`) as D3PPolarSystem
    if (!this.systemKinds.includes(system.kind as 'polar')) {
      throw new Error(`[d3pict] renderer "${this.name}" (D3PPieRenderer) does not support the ${system.kind} coordinate system "${system.name}"; it needs a polar one`)
    }
    data.system = system
    data.group = this.createGroup(chart)
  }

  /** Removes the slices of the chart. */
  protected chartRemoved(_chart: D3PChart, data: PieData): void {
    data.group?.interrupt().remove() // missing when attaching failed half way
  }

  protected override attached(chart: D3PChart, data: D3PRendererChartData<PieData>, subs: D3PSubscriptions): void {
    super.attached(chart, data, subs)
    const pie = data.data
    subs.add(this.bus.on(pie.system.e.changed, () => this.tagDirty(chart)))
    subs.add(this.bus.on(chart.e.resized, () => this.tagDirty(chart))) // no axes, so no scale change to tell it
  }

  // ----- drawing -----

  private readonly current = new WeakMap<Element, ArcState>()

  private hover(chart: D3PChart, data: PieData, key: string | undefined) {
    if (key === data.hovered) return
    data.hovered = key
    this.applyHover(chart, data, true)
  }

  /** How far each slice is moved outwards (0 to 1 of `explode`). */
  private readonly offset = new WeakMap<Element, number>()

  private applyHover(_chart: D3PChart, data: PieData, animate: boolean) {
    const { explode } = this.props
    const self = this
    const place = (el: Element, d: D3PPieSlice, f: number) => {
      self.offset.set(el, f)
      const a = (d.startAngle + d.endAngle) / 2
      return `translate(${explode * f * Math.sin(a)},${-explode * f * Math.cos(a)})`
    }
    const paths = data.group.selectAll<SVGPathElement, D3PPieSlice>('path.slice')
    const goal = (d: D3PPieSlice) => (d.key === data.hovered ? 1 : 0)
    if (!animate) return void paths.attr('transform', function (d) { return place(this, d, goal(d)) })
    paths
      .transition()
      .duration(120)
      .attrTween('transform', function (d) {
        const i = d3.interpolateNumber(self.offset.get(this) ?? 0, goal(d))
        return (t) => place(this, d, i(t))
      })
  }

  private clear(data: PieData) {
    data.group.interrupt().selectAll('*').remove()
  }

  /** Draws the slices at once, with no transition. */
  protected renderData(chart: D3PChart, data: PieData): void {
    this.draw(chart, data, false)
  }
  /** Draws the slices moving from what is on screen to what the data says now. */
  protected renderDataWithTransition(chart: D3PChart, data: PieData): void {
    this.draw(chart, data, true)
  }

  /** Draws the slices going away, towards the center. */
  protected renderDataHidden(chart: D3PChart, data: PieData): void {
    const g = data.system.geometry(chart)
    const [ri, ro] = this.radii(g)
    const arc = d3.arc<ArcState>().innerRadius(ri).outerRadius(ro)
    const self = this
    data.group
      .selectAll<SVGPathElement, D3PPieSlice>('path.slice')
      .transition()
      .duration(D3P_TRANSITION_MS)
      .attr('opacity', 0)
      .attrTween('d', function () {
        const from = self.current.get(this) ?? { startAngle: 0, endAngle: 0, padAngle: 0 }
        const i = d3.interpolateObject(from, { ...from, endAngle: from.startAngle })
        return (t) => arc(i(t) as ArcState) ?? ''
      })
      .on('end', () => this.clear(data))
    data.group.selectAll('text.label').remove()
  }

  private draw(chart: D3PChart, data: PieData, animate: boolean) {
    const g = data.system.geometry(chart)
    const [ri, ro] = this.radii(g)
    const slices = this.layout(g)
    if (!slices.length || ro <= 0) return this.clear(data)
    const { style, padAngle, cornerRadius, labels } = this.props
    const pad = (padAngle * Math.PI) / 180
    const arc = d3.arc<ArcState>().innerRadius(ri).outerRadius(ro).cornerRadius(cornerRadius)
    const target = (d: D3PPieSlice): ArcState => ({ startAngle: d.startAngle, endAngle: d.endAngle, padAngle: pad })
    const collapsed = (a: ArcState): ArcState => ({ ...a, endAngle: a.startAngle, padAngle: 0 })
    const ms = animate ? D3P_TRANSITION_MS : 0
    const self = this
    const tween = (from: ArcState, to: ArcState, el: Element) => {
      const i = d3.interpolateObject(from, to)
      return (t: number) => {
        const v = i(t) as ArcState
        self.current.set(el, v)
        return arc(v) ?? ''
      }
    }

    data.group.attr('transform', `translate(${g.cx},${g.cy})`)
    const paths = data.group
      .selectAll<SVGPathElement, D3PPieSlice>('path.slice')
      .data(slices, (d) => d.key)
      .join(
        (enter) =>
          enter.append('path').attr('class', 'slice').attr('opacity', animate ? 0 : 1).each(function (d) {
            self.current.set(this, collapsed(target(d)))
          }),
        (update) => update,
        (exit) => {
          if (!animate) return exit.interrupt().remove()
          exit
            .transition()
            .duration(ms)
            .attrTween('d', function () {
              const from = self.current.get(this) ?? { startAngle: 0, endAngle: 0, padAngle: 0 }
              return tween(from, collapsed(from), this)
            })
            .remove()
          return exit
        },
      )
    paths.attr('fill', (d) => d.color).attr('stroke', style.stroke).attr('stroke-width', style.strokeWidth)
    if (animate) {
      paths
        .interrupt()
        .transition()
        .duration(ms)
        .attr('opacity', 1)
        .attrTween('d', function (d) {
          return tween(self.current.get(this) ?? collapsed(target(d)), target(d), this)
        })
    } else {
      paths.interrupt().attr('opacity', 1).attr('d', function (d) {
        const to = target(d)
        self.current.set(this, to)
        return arc(to) ?? ''
      })
    }
    this.applyHover(chart, data, false)

    // labels sit at the middle of their slice
    const shown = labels.enabled ? slices.filter((s) => s.percent >= labels.minPercent) : []
    const format = labels.format ?? ((s: D3PPieSlice) => `${Math.round(s.percent * 100)} %`)
    data.group
      .selectAll<SVGTextElement, D3PPieSlice>('text.label')
      .data(shown, (d) => d.key)
      .join('text')
      .attr('class', 'label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 11)
      .attr('fill', labels.color)
      .style('pointer-events', 'none')
      .attr('transform', (d) => {
        const [x, y] = arc.centroid(target(d))
        return `translate(${x},${y})`
      })
      .text((d) => format(d))
  }
}
