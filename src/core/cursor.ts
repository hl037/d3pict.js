import type * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PAxis } from './axis'
import type { D3PAxisFilter } from './axis-manager'
import type { D3PChart } from './chart'
import type { D3PCoordinateSystem, D3PCursorGeometry, D3PLabelAnchor } from './coords'
import { d3pRequireInteractionArea } from './interaction'
import { D3PAttachable } from './object'
import type { D3PPointerEvent } from './pointer'
import { d3pProbe } from './probe'
import { createProps, type D3PProps, type DeepPartial } from './props'
import type { D3PDomainValue } from './util'

/**
 * Props of the cursor: whether it draws a cross on each dimension and the labels on the axes, their styles, and a function that writes the values of the labels.
 */
export interface D3PCursorProps {
  /** Whether the vertical cross (the X position) is drawn (default true). */
  showCrossX: boolean
  /** Whether the horizontal cross (the Y position) is drawn (default true). */
  showCrossY: boolean
  /**
   * Whether a label with the value under the pointer is drawn on each axis (default true). A long label wraps within the room its axis leaves.
   */
  showAxisLabels: boolean
  /**
   * Style of the crosses: the colors of the vertical and horizontal ones, the width, the dash and the opacity.
   */
  crossStyle: { strokeX: string; strokeY: string; strokeWidth: number; strokeDasharray: string; opacity: number }
  /**
   * The labels on the axes. A label is never wider than `maxWidth` pixels, nor than the room the
   * margin leaves it next to its axis, nor (above or under an axis) higher than that room: a longer
   * text wraps onto several lines, and ends with an ellipsis where even that does not fit.
   */
  axisLabelStyle: { background: string; color: string; fontSize: number; padding: number; borderRadius: number; maxWidth: number }
  /** Custom label text: receives the axis, the value and the default formatter. */
  valueFormatter?: (axis: D3PAxis, value: D3PDomainValue, defaultFormatter: (v: any) => string) => string
}

/** Options of the cursor: the axes it follows, its props and the bus. */
export interface D3PCursorIndicatorOptions {
  /** The bus the cursor uses (the global bus by default). */
  bus?: D3PBus
  /** Restrict the cursor to some axes (objects or names): it only shows their values. */
  axes?: D3PAxisFilter
  /** Initial props of the cursor. */
  props?: DeepPartial<D3PCursorProps>
}

type G = d3.Selection<SVGGElement, unknown, null, undefined>

interface CursorData {
  group: G
  labels: G
}

/**
 * Crosshair + axis labels following the mouse on every chart it is attached to. The mouse
 * state is shared: moving over chart A shows the cursor on each chart having axes of the
 * same names. Each coordinate system draws its own crosshair (lines, or a spoke and a circle in
 * polar), at the pointer or, through joined axes, at the corresponding value.
 */
export class D3PCursorIndicator extends D3PAttachable<CursorData> {
  /** The axes the cursor is restricted to, if any. */
  readonly axes: D3PAxisFilter | undefined
  private last: D3PPointerEvent | undefined
  private visible = false
  private readonly propsHandle = createProps<D3PCursorProps>(
    {
      showCrossX: true,
      showCrossY: true,
      showAxisLabels: true,
      crossStyle: { strokeX: '#666', strokeY: '#666', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0.7 },
      axisLabelStyle: { background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 11, padding: 4, borderRadius: 3, maxWidth: 160 },
      valueFormatter: undefined,
    },
    { afterSet: () => this.tagDirty() },
  )

  constructor(opts: D3PCursorIndicatorOptions = {}) {
    super('cursorIndicator', [], opts.bus)
    this.axes = opts.axes
    if (opts.props) this.propsHandle.props(opts.props)
  }

  /** The props of the cursor: which crosses and labels it shows, their styles. */
  get props(): D3PProps<D3PCursorProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the cursor. */
  set props(v: DeepPartial<D3PCursorProps>) {
    this.propsHandle.replace(v)
  }

  protected createData(chart: D3PChart): CursorData {
    const group = chart.layer.overlay.append('g').attr('class', 'cursor-indicator').style('pointer-events', 'none').style('display', 'none')
    const labels = chart.layer.overlay.append('g').attr('class', 'cursor-labels').style('pointer-events', 'none')
    return { group, labels }
  }

  protected attached(chart: D3PChart, _data: CursorData, subs: D3PSubscriptions): void {
    subs.add(
      this.bus.on(chart.event('mousemove'), (p) => {
        this.last = p
        this.visible = true
        this.tagDirty()
      }),
    )
    subs.add(
      this.bus.on(chart.event('mouseleave'), () => {
        this.visible = false
        this.tagDirty()
      }),
    )
    subs.add(this.bus.on(chart.e.resized, () => this.tagDirty(chart)))
    d3pRequireInteractionArea(chart)
  }

  protected override detached(_chart: D3PChart, data: CursorData): void {
    data.group.remove()
    data.labels.remove()
  }

  /** Draws the crosses and, on each axis, a label with the value under the pointer. */
  override render(chart: D3PChart): void {
    if (this.isDestroying) return
    const data = this.chartData.get(chart)
    if (!data) return
    data.labels.selectChildren().remove()
    data.group.selectChildren().remove()
    const hide = () => void data.group.style('display', 'none')
    if (!this.visible || !this.last) return hide()

    // Axes with a value under the pointer (its own, or a joined one), grouped by coordinate system.
    const event = this.last
    const probe = d3pProbe(chart)
    const state = chart.axes.getAxesState(this.axes)
    type Entry = { axis: D3PAxis; a: number }
    const bySystem = new Map<D3PCoordinateSystem, { xs: Entry[]; ys: Entry[] }>()
    const collect = (axes: D3PAxis[], dim: 'xs' | 'ys') => {
      for (const axis of axes) {
        const system = axis.getSystem(chart)
        const value = probe.projectFrom(event, axis)
        const a = value !== undefined ? axis.projectTo(chart, value, event) : undefined
        if (!system || a === undefined) continue
        if (!bySystem.has(system)) bySystem.set(system, { xs: [], ys: [] })
        bySystem.get(system)![dim].push({ axis, a })
      }
    }
    collect(state.x, 'xs')
    collect(state.y, 'ys')
    if (!bySystem.size) return hide()

    const p = this.props
    const cs = p.crossStyle
    data.group.style('display', 'inline')
    const text = (axis: D3PAxis) => {
      const fmt = axis.getTickFormatter(chart)
      const v = probe.projectFrom(event, axis)!
      return p.valueFormatter ? p.valueFormatter(axis, v, fmt) : fmt(v)
    }
    const draw = (cls: string, g: D3PCursorGeometry, stroke: string) => {
      const el: d3.Selection<SVGElement, unknown, null, undefined> =
        g.kind === 'line'
          ? (data.group.append('line').attr('x1', g.x1).attr('y1', g.y1).attr('x2', g.x2).attr('y2', g.y2) as any)
          : g.kind === 'circle'
            ? (data.group.append('circle').attr('cx', g.cx).attr('cy', g.cy).attr('r', g.r).attr('fill', 'none') as any)
            : (data.group.append('path').attr('d', g.d).attr('fill', 'none') as any)
      el.attr('class', cls).attr('stroke', stroke).attr('stroke-width', cs.strokeWidth).attr('stroke-dasharray', cs.strokeDasharray).attr('opacity', cs.opacity)
    }

    for (const [system, { xs, ys }] of bySystem) {
      const a = xs[0]?.a
      const b = ys[0]?.a
      const shapes = system.cursor(chart, p.showCrossX ? a : undefined, p.showCrossY ? b : undefined)
      if (shapes.x) draw('cursor-cross-x', shapes.x, cs.strokeX)
      if (shapes.y) draw('cursor-cross-y', shapes.y, cs.strokeY)

      if (!p.showAxisLabels) continue
      for (const e of xs) {
        const at = system.label(chart, e.axis, 'x', e.a, b)
        if (at) this.drawLabel(data.labels, text(e.axis), at, this.room(chart, at))
      }
      // each Y axis has its own label, on its own side (and its own distance from the plot)
      for (const e of ys) {
        const at = system.label(chart, e.axis, 'y', a, e.a)
        if (at) this.drawLabel(data.labels, text(e.axis), at, this.room(chart, at))
      }
    }
  }

  /** What the margin leaves for a label next to its axis: it must not run out of the chart. */
  private room(chart: D3PChart, at: D3PLabelAnchor): { width: number; height: number } {
    const m = chart.margin
    const max = this.props.axisLabelStyle.maxWidth
    if (at.kind === 'x') return { width: max, height: at.flip ? at.y + m.top - 5 : chart.innerHeight + m.bottom - at.y - 5 }
    return { width: Math.min(max, at.flip ? at.x + m.left - 5 : chart.innerWidth + m.right - at.x - 5), height: Infinity }
  }

  /** Draw a label box. X labels hang below (or above, for a top axis) the axis line; the Y label sits on the outer side. */
  private drawLabel(parent: G, content: string, at: D3PLabelAnchor, room: { width: number; height: number }) {
    const { x, y, kind, flip } = at
    const st = this.props.axisLabelStyle
    const g = parent.append('g')
    // the text is cut to the room: lines of words that fit, as many as the height allows
    const probe = g.append('text').attr('font-size', st.fontSize).attr('visibility', 'hidden')
    const measure = (s: string) => {
      probe.text(s)
      const length = (probe.node() as SVGTextElement).getComputedTextLength?.() ?? 0
      return length || s.length * st.fontSize * 0.6
    }
    const lines = wrapText(content, Math.max(30, room.width - st.padding * 2), Math.max(1, Math.floor((room.height - st.padding * 2) / (st.fontSize * 1.2))), measure)
    probe.remove()
    const texts = lines.map((l, i) => g.append('text').attr('fill', st.color).attr('font-size', st.fontSize).attr('dy', `${(i + 1) * 1.1 - 0.2}em`).text(l))
    let w = 0
    let h = 0
    try {
      const box = g.node()!.getBBox()
      w = box.width
      h = box.height
    } catch {
      /* no layout engine */
    }
    if (!w || !h) {
      w = Math.max(...lines.map((l) => l.length)) * st.fontSize * 0.6
      h = lines.length * st.fontSize * 1.2
    }
    const bw = w + st.padding * 2
    const bh = h + st.padding * 2
    let bx: number
    let by: number
    if (kind === 'x') {
      bx = x - bw / 2
      by = flip ? y - bh - 5 : y + 5
    } else {
      bx = flip ? x - bw - 5 : x + 5
      by = y - bh / 2
    }
    g.insert('rect', 'text').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh).attr('rx', st.borderRadius).attr('fill', st.background)
    texts.forEach((t) => t.attr('x', bx + st.padding).attr('y', by + st.padding))
  }
}

/**
 * Cut `text` into lines no wider than `maxWidth` (`measure` gives the width of a string): at the
 * spaces, and inside a word that is too long on its own. At most `maxLines` lines; the last one
 * ends with an ellipsis when something was left out.
 */
export function wrapText(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  const flush = () => {
    if (line) lines.push(line)
    line = ''
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (measure(word) > maxWidth) {
      // a word that does not fit anywhere: cut it where it has to be
      flush()
      let rest = word
      while (rest) {
        let n = rest.length
        while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n--
        lines.push(rest.slice(0, n))
        rest = rest.slice(n)
      }
      continue
    }
    const joined = line ? `${line} ${word}` : word
    if (measure(joined) <= maxWidth) line = joined
    else {
      flush()
      line = word
    }
  }
  flush()
  if (lines.length <= maxLines) return lines.length ? lines : ['']
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last}…`
  return kept
}
