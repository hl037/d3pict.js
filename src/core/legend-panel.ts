import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PChart } from './chart'
import { D3PLegendManager, type D3PLegend } from './legend'
import type { D3PSide } from './layout'
import { D3PAttachable } from './object'
import { createProps, type D3PProps, type DeepPartial } from './props'
import type { D3PSeriesRenderer } from './renderers/base'
import { D3PSlot } from './slot'

/** A corner of the plot, where a legend panel can float. */
export type D3PLegendPanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** Props of the legend panel: its alignment along its side and its style. */
export interface D3PLegendPanelProps {
  /** Along the side, over the plot: the start, the middle or the end of it. */
  align: 'start' | 'center' | 'end'
  /** Color and size of the text, the gap between entries and the size of the swatch. */
  style: { color: string; fontSize: number; gap: number; swatch: number }
}

/**
 * Options of the legend panel: where it goes (`placement`), its size, the renderers it lists, its props and the bus.
 */
export interface D3PLegendPanelOptions {
  /** The bus the panel uses (the global bus by default). */
  bus?: D3PBus
  /**
   * Where the legend goes: a side of the plot, from which it takes room (default `bottom`), or a
   * corner of the plot, over it.
   */
  placement?: D3PSide | D3PLegendPanelCorner
  /**
   * Width of a strip on the left or the right (default 140). Above or under the plot the height
   * follows the entries, which wrap onto as many lines as they need (at most a third of the chart,
   * then the list scrolls); give a number to fix it. A corner takes no room.
   */
  size?: number
  /** Restrict the legend to some renderers (objects or names). */
  series?: ReadonlyArray<D3PSeriesRenderer | string>
  /** Initial props of the panel. */
  props?: DeepPartial<D3PLegendPanelProps>
}

/**
 * A standard legend: one line per entry of the renderers (a name, a color, a click that shows or
 * hides what it stands for). It reads the entries from a `D3PLegendManager` and draws them in the
 * element of a `D3PSlot`, which is what a legend of your own does too. Opt in by attaching it to the
 * chart; instead, `D3PLegendBundle` leaves the content to you.
 */
export class D3PLegendPanel extends D3PAttachable<{ manager: D3PLegendManager; slot: D3PSlot; legend?: D3PLegend }> {
  private readonly placement: D3PSide | D3PLegendPanelCorner
  private readonly size: number | undefined
  private readonly series: D3PLegendPanelOptions['series']
  private readonly propsHandle = createProps<D3PLegendPanelProps>(
    { align: 'center', style: { color: 'inherit', fontSize: 12, gap: 14, swatch: 10 } },
    { afterSet: () => this.draw() },
  )

  constructor(opts: D3PLegendPanelOptions = {}) {
    super('legendPanel', [], opts.bus)
    this.placement = opts.placement ?? 'bottom'
    this.size = opts.size
    this.series = opts.series
    if (opts.props) this.propsHandle.props(opts.props)
  }

  /** The props of the panel: its alignment and its style. */
  get props(): D3PProps<D3PLegendPanelProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the panel. */
  set props(v: DeepPartial<D3PLegendPanelProps>) {
    this.propsHandle.replace(v)
  }

  private get side(): D3PSide | 'inside' {
    return ['top', 'right', 'bottom', 'left'].includes(this.placement) ? (this.placement as D3PSide) : 'inside'
  }

  protected createData(): { manager: D3PLegendManager; slot: D3PSlot } {
    const vertical = this.side === 'left' || this.side === 'right'
    return {
      manager: new D3PLegendManager({ bus: this.bus, series: this.series }),
      slot: new D3PSlot({ bus: this.bus, side: this.side, size: this.size ?? (vertical ? 140 : 28) }),
    }
  }

  protected attached(chart: D3PChart, data: { manager: D3PLegendManager; slot: D3PSlot; legend?: D3PLegend }, subs: D3PSubscriptions): void {
    // the manager is this panel's own: its changes are about this chart's legend only
    subs.add(
      this.bus.on(data.manager.e.changed, (legend) => {
        data.legend = legend
        this.draw()
      }),
    )
    // the entries wrap at the width of the plot: when it changes, they take another number of lines
    subs.add(this.bus.on(chart.e.resized, () => this.draw()))
    data.slot.addToChart(chart)
    data.manager.addToChart(chart)
    data.manager.refresh(chart)
  }

  protected override detached(_chart: D3PChart, data: { manager: D3PLegendManager; slot: D3PSlot }): void {
    data.manager.destroy()
    data.slot.destroy()
  }

  private draw() {
    if (this.isDestroying) return
    const { align, style } = this.props
    const side = this.side
    const vertical = side === 'left' || side === 'right' || side === 'inside'
    for (const [chart, data] of this.chartData) {
      const box = data.slot.getContainer(chart)
      if (!box) continue
      box.replaceChildren()
      const list = document.createElement('div')
      list.className = 'd3pict-legend'
      // a legend longer than its room scrolls instead of being cut
      Object.assign(list.style, { display: 'flex', flexDirection: vertical ? 'column' : 'row', flexWrap: 'wrap', gap: vertical ? '4px' : `0 ${style.gap}px`, pointerEvents: 'auto', font: `${style.fontSize}px sans-serif`, color: style.color, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box' })
      for (const entry of data.legend?.series ?? []) {
        const item = document.createElement('div')
        item.className = 'd3pict-legend-entry'
        Object.assign(item.style, { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', opacity: entry.visible ? '1' : '0.4', whiteSpace: 'nowrap', maxWidth: '100%' })
        item.onclick = () => entry.toggle()
        const swatch = document.createElement('span')
        Object.assign(swatch.style, { display: 'inline-block', width: `${style.swatch}px`, height: `${style.swatch}px`, background: entry.color })
        Object.assign(swatch.style, { flex: 'none' })
        const label = document.createElement('span')
        label.textContent = entry.label
        Object.assign(label.style, { overflow: 'hidden', textOverflow: 'ellipsis' })
        item.title = entry.label
        item.append(swatch, label)
        list.append(item)
      }
      if (side === 'inside') {
        const [v, h] = this.placement.split('-')
        Object.assign(list.style, { position: 'absolute', [v]: '4px', [h]: '4px', background: 'color-mix(in srgb, canvas 80%, transparent)', padding: '2px 6px', borderRadius: '4px' })
      } else {
        const justify = { start: 'flex-start', center: 'center', end: 'flex-end' }[align]
        Object.assign(box.style, { display: 'flex', alignItems: vertical ? justify : 'center', justifyContent: vertical ? 'flex-start' : justify })
      }
      box.append(list)
      this.fit(chart, data, list)
    }
  }

  /** Above or under the plot: the strip is as high as the lines the entries wrap onto, within a third of the chart. */
  private fit(chart: D3PChart, data: { slot: D3PSlot }, list: HTMLElement) {
    if (this.size !== undefined || (this.side !== 'top' && this.side !== 'bottom')) return
    list.style.maxHeight = 'none'
    const wanted = Math.ceil(list.scrollHeight) // 0 where nothing is laid out
    list.style.maxHeight = '100%'
    if (!wanted) return
    const size = Math.max(28, Math.min(wanted + 8, Math.floor(chart.height / 3)))
    if (Math.abs(size - data.slot.size) > 1) data.slot.size = size
  }
}
