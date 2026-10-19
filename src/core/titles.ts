import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PAxis } from './axis'
import type { D3PChart } from './chart'
import type { D3PPolarSystem } from './coords'
import type { D3PRequirement, D3PSide } from './layout'
import { D3PAttachable } from './object'
import { createProps, type D3PProps, type DeepPartial } from './props'
import { D3PSlot } from './slot'

/**
 * Standard titles. They are made the way a title of your own would be: a `D3PSlot` for the room
 * around the plot, and text put in the element of the slot. Nothing here is special to the
 * library; use them as they are, change their props, or write your own the same way.
 */

// ---------------------------------------------------------------------------
// Chart title
// ---------------------------------------------------------------------------

export interface D3PTitleProps {
  /** The title. */
  text: string
  /** A smaller line under the title. */
  subtitle: string
  /** Along the plot: the start, the middle or the end of it. */
  align: 'start' | 'center' | 'end'
  /** Colors, sizes and weight of the title and of the subtitle. */
  style: { color: string; fontSize: number; fontWeight: string; subtitleColor: string; subtitleFontSize: number }
}

/**
 * Options of a title: the side it sits on, its size, its props (text, subtitle, style) and the bus.
 */
export interface D3PTitleOptions {
  /** The bus the title uses (the global bus by default). */
  bus?: D3PBus
  /** Above the chart (default) or under it. */
  side?: 'top' | 'bottom'
  /** Height of the strip in pixels; default: fits the title, and the subtitle if there is one. */
  size?: number
  /** Props of the title: at least its text. */
  props?: DeepPartial<D3PTitleProps> & { text: string }
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const

/** A title over (or under) the plot, with an optional subtitle. */
export class D3PTitle extends D3PAttachable<{}> {
  private readonly slot: D3PSlot
  private readonly fixedSize: number | undefined
  private readonly propsHandle = createProps<D3PTitleProps>(
    { text: '', subtitle: '', align: 'center', style: { color: 'inherit', fontSize: 16, fontWeight: '600', subtitleColor: 'inherit', subtitleFontSize: 12 } },
    { afterSet: () => this.draw() },
  )

  constructor(opts: D3PTitleOptions) {
    super('title', [], opts.bus)
    this.propsHandle.props(opts.props ?? {})
    this.fixedSize = opts.size
    this.slot = new D3PSlot({ bus: opts.bus, side: opts.side ?? 'top', size: opts.size ?? this.fit(), order: 0 })
  }

  /** The props of the title: its text, its subtitle, its alignment and its style. */
  get props(): D3PProps<D3PTitleProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the title. */
  set props(v: DeepPartial<D3PTitleProps>) {
    this.propsHandle.replace(v)
  }

  /** Room the text needs: the title, and the subtitle under it. */
  private fit(): number {
    const { fontSize, subtitleFontSize } = this.props.style
    return Math.round(fontSize * 1.5 + (this.props.subtitle ? subtitleFontSize * 1.4 : 0) + 8)
  }

  protected createData(): {} {
    return {}
  }

  protected attached(chart: D3PChart): void {
    this.slot.addToChart(chart)
    this.draw()
  }

  protected override detached(chart: D3PChart): void {
    this.slot.removeFromChart(chart)
  }

  protected override onDestroy(): void {
    super.onDestroy()
    this.slot.destroy()
  }

  private draw() {
    if (this.isDestroying || !this.slot) return // the props are set before the slot exists
    if (this.fixedSize === undefined) this.slot.size = this.fit()
    const { text, subtitle, align, style } = this.props
    for (const chart of this.getCharts()) {
      const box = this.slot.getContainer(chart)
      if (!box) continue
      box.replaceChildren()
      Object.assign(box.style, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: ALIGN[align], font: '12px sans-serif', overflow: 'hidden' })
      const title = document.createElement('div')
      title.className = 'd3pict-title'
      title.textContent = text
      Object.assign(title.style, { color: style.color, fontSize: `${style.fontSize}px`, fontWeight: style.fontWeight, lineHeight: '1.3' })
      box.append(title)
      if (subtitle) {
        const sub = document.createElement('div')
        sub.className = 'd3pict-subtitle'
        sub.textContent = subtitle
        Object.assign(sub.style, { color: style.subtitleColor, fontSize: `${style.subtitleFontSize}px`, opacity: '0.7', lineHeight: '1.4' })
        box.append(sub)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Axis title
// ---------------------------------------------------------------------------

/**
 * Props of an axis title: its text (the name of the axis by default), its alignment along the axis, the gap to the labels and its style.
 */
export interface D3PAxisTitleProps {
  /** Default: the display name of the axis. */
  text: string
  /** Where it is along the axis: its start, its middle (the default) or its end. */
  align: 'start' | 'center' | 'end'
  /** Pixels between the tick labels of the axis and its title (cartesian axes). */
  gap: number
  /** Color, size and weight of the text. */
  style: { color: string; fontSize: number; fontWeight: string }
}

/** Options of an axis title: the axis it names, its size, its props and the bus. */
export interface D3PAxisTitleOptions {
  /** The bus the axis title uses (the global bus by default). */
  bus?: D3PBus
  /** The axis (object or name) the title is for. */
  axis: D3PAxis | string
  /** Thickness of the title in pixels: its height on a top or bottom axis, its width on a left or right one (default 18). */
  size?: number
  /** Initial props of the axis title. */
  props?: DeepPartial<D3PAxisTitleProps>
}

interface AxisTitleData {
  slot?: D3PSlot
  side?: D3PSide
  requirement?: D3PRequirement
  /** How far the labels of the axis reached the last times they were measured: it only grows, so the title does not wobble. */
  measured?: number
  attempts: number
}

const SIDES: Record<string, D3PSide> = { bottom: 'bottom', top: 'top', left: 'left', right: 'right' }

/**
 * The title of an axis. On an axis of a cartesian chart it sits against the tick labels, on the
 * outer side, `gap` pixels from them, wherever the axis is: with several axes on one side each has its
 * title against its own labels (leave room for it between them, with the `offset` of the axes). The
 * plot keeps the room the axis and its title need together. On the left or right it is turned to
 * read along the axis. For an axis of a polar system, which has no side of its own, the title is
 * against the disc: under it for an angle axis, on its left for a radius axis.
 */
export class D3PAxisTitle extends D3PAttachable<AxisTitleData> {
  private readonly axisRef: D3PAxis | string
  private readonly size: number
  private readonly propsHandle = createProps<D3PAxisTitleProps>(
    { text: '', align: 'center', gap: 6, style: { color: 'inherit', fontSize: 12, fontWeight: '500' } },
    { afterSet: () => this.refresh() },
  )

  constructor(opts: D3PAxisTitleOptions) {
    super('axisTitle', [], opts.bus)
    this.axisRef = opts.axis
    this.size = opts.size ?? 18
    if (opts.props) this.propsHandle.props(opts.props)
  }

  /** The props of the axis title: its text, its alignment, its gap and its style. */
  get props(): D3PProps<D3PAxisTitleProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the axis title. */
  set props(v: DeepPartial<D3PAxisTitleProps>) {
    this.propsHandle.replace(v)
  }

  protected createData(): AxisTitleData {
    return { attempts: 0 }
  }

  protected attached(chart: D3PChart, data: AxisTitleData, subs: D3PSubscriptions): void {
    // the axis may be added to the chart after the title
    subs.add(this.bus.on(chart.axes.e.axesListChanged, () => this.sync(chart, data, subs)))
    // its labels change with the size of the chart, and with its scale
    subs.add(this.bus.on(chart.e.resized, () => this.measureAgain(chart, data)))
    this.sync(chart, data, subs)
  }

  protected override detached(_chart: D3PChart, data: AxisTitleData): void {
    data.requirement?.release()
    data.slot?.destroy()
  }

  private axisOn(chart: D3PChart): D3PAxis | undefined {
    const { x, y } = chart.axes.getAxesState()
    return [...x, ...y].find((a) => a === this.axisRef || a.name === this.axisRef)
  }

  private measureAgain(chart: D3PChart, data: AxisTitleData) {
    data.attempts = 0
    this.tagDirty(chart)
  }

  private sync(chart: D3PChart, data: AxisTitleData, subs: D3PSubscriptions) {
    const axis = this.axisOn(chart)
    if (!axis || data.slot) return
    const side = SIDES[axis.position]
    data.side = side ?? (axis.position === 'angle' ? 'bottom' : 'left')
    data.requirement = chart.layout.require(data.side, 0)
    data.slot = new D3PSlot({ bus: this.bus, side: 'inside', place: () => (side ? this.rectOf(chart, data, axis) : this.rectAroundDisc(chart, data, axis)) })
    if (side) subs.add(this.bus.on(axis.e.scaleChanged, (e) => e.chart === chart && this.measureAgain(chart, data)))
    data.slot.addToChart(chart)
    this.refresh()
    this.tagDirty(chart)
  }

  /** The tick labels reach `extent` pixels from the axis; before they are measured, as far as the margin leaves room for. */
  private extentOf(chart: D3PChart, data: AxisTitleData, axis: D3PAxis): number {
    const { gap } = this.props
    return data.measured ?? Math.max(0, chart.baseMargin[data.side!] - axis.getOffset(chart) - gap - this.size)
  }

  /** Where the title is: against the labels of its axis, on the outer side. */
  private rectOf(chart: D3PChart, data: AxisTitleData, axis: D3PAxis) {
    const t = this.size
    const need = axis.getOffset(chart) + this.extentOf(chart, data, axis) + this.props.gap + t
    if (data.requirement) data.requirement.distance = need
    const m = chart.margin
    switch (data.side) {
      case 'left':
        return { x: m.left - need, y: m.top, width: t, height: chart.innerHeight }
      case 'right':
        return { x: chart.width - m.right + need - t, y: m.top, width: t, height: chart.innerHeight }
      case 'top':
        return { x: m.left, y: m.top - need, width: chart.innerWidth, height: t }
      default:
        return { x: m.left, y: chart.height - m.bottom + need - t, width: chart.innerWidth, height: t }
    }
  }

  /** Polar axis: under the disc (angle) or on its left (radius), past its tick labels. */
  private rectAroundDisc(chart: D3PChart, data: AxisTitleData, axis: D3PAxis) {
    const t = this.size
    const system = axis.getSystem(chart) as unknown as D3PPolarSystem
    const g = system.geometry(chart)
    const labels = system.props.padding // the room the disc keeps around its ring for the labels of the angle axis
    const m = chart.margin
    if (data.side === 'bottom') {
      const rect = { x: m.left + g.cx - g.R, y: m.top + g.cy + g.R + labels + this.props.gap, width: 2 * g.R, height: t }
      // what sticks out of the plot is asked of the margin (nothing, when the disc leaves room)
      data.requirement!.distance = Math.max(0, rect.y + t - (chart.height - m.bottom))
      return rect
    }
    const rect = { x: m.left + g.cx - g.R - labels - this.props.gap - t, y: m.top + g.cy - g.R, width: t, height: 2 * g.R }
    data.requirement!.distance = Math.max(0, m.left - rect.x)
    return rect
  }

  /** Writes the title against the labels of the axis, and asks for the room it needs. */
  override render(chart: D3PChart): void {
    const data = this.chartData.get(chart)
    const axis = this.axisOn(chart)
    if (!data?.requirement || !axis || !SIDES[axis.position]) return // a polar axis is placed from the disc, not from labels
    const extent = axis.getExtent(chart)
    if (extent === undefined) {
      // the axis is not drawn yet: look again in a moment (nothing is laid out where there is no browser, so not for ever)
      if (data.attempts++ < 5) this.tagDirty(chart)
      return
    }
    const measured = Math.max(data.measured ?? 0, Math.ceil(extent))
    if (measured === data.measured) return
    data.measured = measured
    data.slot?.update(chart) // moves the title; the requirement it makes may move the plot too
  }

  private refresh() {
    this.draw()
  }

  private draw() {
    if (this.isDestroying) return
    const { text, align, style } = this.props
    for (const [chart, data] of this.chartData) {
      const box = data.slot?.getContainer(chart)
      const axis = this.axisOn(chart)
      if (!box || !axis || !data.side) continue
      const vertical = data.side === 'left' || data.side === 'right'
      box.replaceChildren()
      Object.assign(box.style, { display: 'flex', alignItems: 'center', justifyContent: ALIGN[align], overflow: 'hidden', font: '12px sans-serif' })
      const label = document.createElement('div')
      label.className = 'd3pict-axis-title'
      label.textContent = text || axis.props.displayName
      Object.assign(label.style, { color: style.color, fontSize: `${style.fontSize}px`, fontWeight: style.fontWeight, whiteSpace: 'nowrap', writingMode: vertical ? 'vertical-rl' : 'horizontal-tb', transform: data.side === 'left' ? 'rotate(180deg)' : '' })
      box.append(label)
      data.slot!.update(chart)
    }
  }
}
