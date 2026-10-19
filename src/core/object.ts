import { D3PBus, D3PSubscriptions, d3pEventTable, getGlobalBus, type D3PEvent, type D3PEventTable } from './bus'
import type { D3PChart } from './chart'
import { emitDirty, type D3PRenderable } from './render'

/** What goes on a chart: anything attachable (axes, renderers, the cursor, the tooltip, tools, annotations...). */
export interface D3PChartObject {
  /** Attaches the object to a chart: it creates what it needs there and draws. */
  addToChart(chart: D3PChart): void
  /** Detaches the object from a chart: its marks are removed there. */
  removeFromChart(chart: D3PChart): void
  /** Detaches the object from all its charts and releases what it holds. */
  destroy(): void
}

/** Options shared by every object: the bus it uses (the global bus by default). */
export interface D3PObjectOptions {
  /** The bus the object uses (the global bus by default). */
  bus?: D3PBus
}

/**
 * Base of every emitter: owns a bus reference, a table of per-instance event symbols
 * (always containing `destroyed`) and a subscription bag released on `destroy()`.
 */
export abstract class D3PObject<M extends object = {}> {
  /** The bus the object uses for its events. */
  readonly bus: D3PBus
  /** The events of the object, by name: `destroyed` for all, and its own (`axis.e.scaleChanged`). */
  readonly e: D3PEventTable<M & { destroyed: D3PObject<any> }>
  /** Set when `destroy` starts: the object is not drawn after that. */
  isDestroying = false
  /** The subscriptions of the object, released when it is destroyed. */
  protected readonly subs = new D3PSubscriptions()

  constructor(label: string, eventNames: readonly (keyof M & string)[] = [], bus?: D3PBus) {
    this.bus = bus ?? getGlobalBus()
    this.e = d3pEventTable<M & { destroyed: D3PObject<any> }>(label, [...eventNames, 'destroyed'] as any)
  }

  /** Emits one of its own events on the bus. */
  protected fire<P>(event: D3PEvent<P>, ...args: P extends void ? [] : [payload: P]): void {
    void (this.bus.emit as (e: symbol, p?: unknown) => Promise<void>)(event, args[0])
  }

  /** Hook run first on destroy (detach from partners, release DOM...). */
  protected onDestroy(): void {}

  /**
   * Detaches the object from all its charts, announces `destroyed` and releases its subscriptions. The object cannot be used afterwards.
   */
  destroy(): void {
    if (this.isDestroying) return
    this.isDestroying = true
    this.onDestroy()
    this.fire(this.e.destroyed as D3PEvent<D3PObject<any>>, this as never)
    this.subs.clear()
  }
}

/**
 * Object attachable to N charts, keeping one `D` record per chart. It detaches itself when a
 * chart is destroyed and on its own `destroy()`.
 */
export abstract class D3PAttachable<D, M extends object = {}> extends D3PObject<M> implements D3PRenderable<D3PChart> {
  /** What the object keeps for each chart it is attached to. */
  protected readonly chartData = new Map<D3PChart, D>()
  private readonly chartSubs = new Map<D3PChart, D3PSubscriptions>()

  /** Build the per-chart record. Must not rely on other objects of the chart. */
  protected abstract createData(chart: D3PChart): D
  /** Subscribe / create DOM. Subscriptions added to `subs` are released on detach. */
  protected abstract attached(chart: D3PChart, data: D, subs: D3PSubscriptions): void
  /** DOM / registry cleanup (subscriptions are released afterwards). */
  protected detached(_chart: D3PChart, _data: D): void {}

  /** Attaches the object to a chart; nothing happens if it already is attached to it. */
  addToChart(chart: D3PChart): void {
    if (this.isDestroying) throw new Error('[d3pict] cannot attach a destroyed object')
    if (chart.bus !== this.bus) throw new Error('[d3pict] an object and its chart must share the same bus')
    if (this.chartData.has(chart)) return
    const subs = new D3PSubscriptions()
    const data = this.createData(chart)
    this.chartData.set(chart, data)
    this.chartSubs.set(chart, subs)
    subs.add(this.bus.on(chart.e.destroyed, () => this.removeFromChart(chart)))
    try {
      this.attached(chart, data, subs)
    } catch (e) {
      this.removeFromChart(chart)
      throw e
    }
  }

  /** Detaches the object from a chart; nothing happens if it is not attached to it. */
  removeFromChart(chart: D3PChart): void {
    const data = this.chartData.get(chart)
    if (data === undefined && !this.chartData.has(chart)) return
    this.detached(chart, data as D)
    this.chartSubs.get(chart)?.clear()
    this.chartSubs.delete(chart)
    this.chartData.delete(chart)
  }

  /** The charts the object is attached to. */
  getCharts(): D3PChart[] {
    return [...this.chartData.keys()]
  }

  /** Whether the object is attached to this chart. */
  hasChart(chart: D3PChart): boolean {
    return this.chartData.has(chart)
  }

  protected override onDestroy(): void {
    for (const c of this.getCharts()) this.removeFromChart(c)
  }

  /** Schedule a redraw on one chart (or all attached charts). */
  tagDirty(chart?: D3PChart): void {
    if (this.isDestroying) return
    for (const c of chart ? [chart] : this.getCharts()) {
      if (this.chartData.has(c)) emitDirty(this.bus, { target: c, renderable: this })
    }
  }

  /**
   * Draws the object on a chart. The render manager calls it, once per frame, for the objects that asked for it.
   */
  render(_chart: D3PChart): void | Promise<void> {}
}

