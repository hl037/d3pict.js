import * as d3 from 'd3'
import type { D3PBus, D3PSubscriptions } from './bus'
import type { D3PChart } from './chart'
import { D3PAttachable } from './object'
import { D3PDragEvent, D3PPointerEvent, D3PWheelEvent } from './pointer'
import { D3PViewportPoint } from './projection'
import { d3pServiceKey } from './services'
import { d3pStartTracking } from './util'

/**
 * Key of the service that holds the interaction area of a chart (the zone that receives the pointer).
 */
export const D3P_INTERACTION_AREA = d3pServiceKey<D3PInteractionArea>('interactionArea')

/**
 * Ask for an interaction area on `chart`: nothing happens if one is registered, otherwise
 * `needInteractionArea` is emitted (framework adapters answer by creating one).
 */
export function d3pRequireInteractionArea(chart: D3PChart): void {
  if (!chart.get(D3P_INTERACTION_AREA)) chart.emitEvent('needInteractionArea', chart)
}

/**
 * Options of an interaction area: the bus, and whether the bursts of moves are merged to one per frame.
 */
export interface D3PInteractionAreaOptions {
  /** The bus the area uses (the global bus by default). */
  bus?: D3PBus
  /** Merge `mousemove`/`drag` bursts to the latest one per animation frame (default true). */
  coalesce?: boolean
}

interface AreaChartData {
  rect: d3.Selection<SVGRectElement, unknown, null, undefined>
  /** The last move of the pointer over the chart, while it is still there. */
  last?: D3PPointerEvent
  stopTracking?: () => void
  dragging: boolean
  start?: D3PViewportPoint
  pendingMove?: D3PPointerEvent
  pendingDrag?: D3PDragEvent
  frame?: () => void
}

/**
 * The only source of mouse events: translates DOM events into chart-addressed events
 * (`chart.event('mousemove')`...), each a {@link D3PPointerEvent} that projects the pointer
 * lazily and once.
 *
 * What is under a still pointer changes when the chart does: a zoom, a resize, a series that
 * gets other data or is hidden. The area then emits `mousemove` again, at the same pixel (at most
 * once per frame), so that the cursor, the markers and the tooltip follow without the pointer moving.
 */
export class D3PInteractionArea extends D3PAttachable<AreaChartData> {
  private readonly coalesce: boolean

  constructor(opts: D3PInteractionAreaOptions = {}) {
    super('interactionArea', [], opts.bus)
    this.coalesce = opts.coalesce ?? true
  }

  protected createData(chart: D3PChart): AreaChartData {
    const rect = chart.layer.interaction.back
      .append('rect')
      .attr('class', 'interaction-area')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', chart.innerWidth)
      .attr('height', chart.innerHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
    return { rect, dragging: false }
  }

  protected attached(chart: D3PChart, data: AreaChartData, subs: D3PSubscriptions): void {
    const node = data.rect.node()!
    subs.add(
      this.bus.on(chart.e.resized, () => data.rect.attr('width', chart.innerWidth).attr('height', chart.innerHeight)),
    )

    data.rect.on('mousedown', (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      data.stopTracking?.()
      data.stopTracking = d3pStartTracking(event, node, {
        mouseDown: (e) => {
          this.flushPending(chart, data)
          const { x, y } = e.element
          const down = new D3PPointerEvent(chart, x, y, e.original)
          data.start = down.point
          data.dragging = true
          chart.emitEvent('mousedown', down)
        },
        mouseMove: (e) => {
          const { x, y } = e.element
          this.queue(chart, data, new D3PPointerEvent(chart, x, y, e.original), this.dragEvent(chart, data, x, y, e.original))
        },
        mouseUp: (e) => {
          this.flushPending(chart, data)
          const { x, y } = e.element
          const drag = this.dragEvent(chart, data, x, y, e.original)
          data.dragging = false
          data.stopTracking = undefined
          data.start = undefined
          chart.emitEvent('mouseup', new D3PPointerEvent(chart, x, y, e.original))
          if (drag) chart.emitEvent('dragend', drag)
        },
      })
    })

    data.rect.on('mousemove', (event: MouseEvent) => {
      if (data.dragging) return
      const [x, y] = d3.pointer(event, node)
      const move = new D3PPointerEvent(chart, x, y, event)
      data.last = move
      this.queue(chart, data, move)
    })

    data.rect.on('mouseleave', (event: MouseEvent) => {
      data.last = undefined
      this.flushPending(chart, data)
      const [x, y] = d3.pointer(event, node)
      chart.emitEvent('mouseleave', new D3PPointerEvent(chart, x, y, event))
    })

    data.rect.on('wheel', (event: WheelEvent) => {
      // the page keeps scrolling over a chart that has no wheel tool
      if (this.bus.hasHandlers(chart.event('wheel'))) event.preventDefault()
      const [x, y] = d3.pointer(event, node)
      chart.emitEvent('wheel', new D3PWheelEvent(chart, x, y, event))
    })

    this.watchView(chart, data, subs)
    chart.provide(D3P_INTERACTION_AREA, this)
  }

  /**
   * Emit the last move again when what is under the pointer changes: the scale of an axis (zoom, pan,
   * resize, an auto domain fitting new data), the data of a series, or its visibility.
   */
  private watchView(chart: D3PChart, data: AreaChartData, subs: D3PSubscriptions) {
    const refresh = () => {
      // a move is already on its way, and it reads the new state
      if (!data.last || data.dragging || data.pendingMove) return
      this.queue(chart, data, new D3PPointerEvent(chart, data.last.x, data.last.y, data.last.original))
    }
    const watched = new Map<object, () => void>()
    const sync = () => {
      const wanted = new Map<object, () => () => void>()
      const { x, y } = chart.axes.getAxesState()
      for (const axis of [...x, ...y]) wanted.set(axis, () => this.bus.on(axis.e.scaleChanged, (p) => p.chart === chart && refresh()))
      for (const renderer of chart.renderers.getSeries()) {
        wanted.set(renderer, () => this.bus.on(renderer.e.visibilityChanged, refresh))
        wanted.set(renderer.series, () => this.bus.on(renderer.series.e.dataChanged, refresh))
      }
      for (const [key, off] of watched) if (!wanted.has(key)) (off(), watched.delete(key))
      for (const [key, listen] of wanted) if (!watched.has(key)) watched.set(key, listen())
    }
    subs.add(this.bus.on(chart.axes.e.axesListChanged, sync))
    subs.add(this.bus.on(chart.renderers.e.seriesRendererListChanged, sync))
    subs.add(() => watched.forEach((off) => off()))
    sync()
  }

  protected override detached(chart: D3PChart, data: AreaChartData): void {
    chart.services.remove(D3P_INTERACTION_AREA, this)
    data.frame?.()
    data.stopTracking?.()
    data.rect.remove()
  }

  private dragEvent(chart: D3PChart, data: AreaChartData, x: number, y: number, original: MouseEvent): D3PDragEvent | undefined {
    return data.start ? new D3PDragEvent(chart, x, y, original, data.start) : undefined
  }

  // ----- burst coalescing -----

  private queue(chart: D3PChart, data: AreaChartData, move: D3PPointerEvent, drag?: D3PDragEvent) {
    if (!this.coalesce) {
      chart.emitEvent('mousemove', move)
      if (drag) chart.emitEvent('drag', drag)
      return
    }
    data.pendingMove = move
    if (drag) data.pendingDrag = drag
    if (data.frame) return
    const run = () => {
      data.frame = undefined
      this.flushPending(chart, data)
    }
    if (typeof requestAnimationFrame === 'function') {
      const h = requestAnimationFrame(run)
      data.frame = () => cancelAnimationFrame(h)
    } else {
      const h = setTimeout(run, 0)
      data.frame = () => clearTimeout(h)
    }
  }

  private flushPending(chart: D3PChart, data: AreaChartData) {
    data.frame?.()
    data.frame = undefined
    const { pendingMove, pendingDrag } = data
    data.pendingMove = data.pendingDrag = undefined
    if (pendingMove) chart.emitEvent('mousemove', pendingMove)
    if (pendingDrag) chart.emitEvent('drag', pendingDrag)
  }
}

/**
 * Framework-agnostic "automatic interaction area": answers `needInteractionArea` by creating
 * an area when none is registered, and destroys its own as soon as another one is announced.
 * Returns a disposer. Used by the Vue and React chart components; with the bare core, install it
 * before attaching the tools (they ask for the area when attached) or add a `D3PInteractionArea` yourself.
 */
export function d3pAutoInteractionArea(chart: D3PChart): () => void {
  let own: D3PInteractionArea | undefined
  const offNeed = chart.bus.on(chart.event('needInteractionArea'), () => {
    if (own || chart.isDestroying || chart.get(D3P_INTERACTION_AREA)) return
    own = new D3PInteractionArea({ bus: chart.bus })
    own.addToChart(chart)
  })
  const offWatch = chart.services.watch(D3P_INTERACTION_AREA, (s) => {
    if (own && s !== undefined && s !== own) {
      own.destroy()
      own = undefined
    }
  })
  return () => {
    offNeed()
    offWatch()
    own?.destroy()
    own = undefined
  }
}
