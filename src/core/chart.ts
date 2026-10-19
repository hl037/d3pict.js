import * as d3 from 'd3'
import { D3PBus, d3pEvent, type D3PEvent } from './bus'
import { D3PObject, type D3PObjectOptions } from './object'
import { D3PLayout } from './layout'
import { D3PServiceRegistry, type D3PServiceKey } from './services'
import { D3PAxisManager, D3P_AXES } from './axis-manager'
import { D3PCoordinates, D3P_COORDS } from './coords'
import { D3PSeriesRendererManager, D3P_RENDERERS } from './renderer-manager'
import { getRenderManager, type D3PRenderTarget } from './render'
import type { D3PDragEvent, D3PPointerEvent, D3PWheelEvent } from './pointer'
import type { D3PLegend } from './legend'
import type { D3PTooltipData } from './tooltip'

/** The room kept around the plot, in pixels, on each side. */
export interface D3PMargin {
  /** Room above the plot, in pixels. */
  top: number
  /** Room on the right of the plot, in pixels. */
  right: number
  /** Room under the plot, in pixels. */
  bottom: number
  /** Room on the left of the plot, in pixels. */
  left: number
}

/**
 * Options of a chart: its container, its size (the container's by default), its margin, its name, the delay of the resize, and the bus.
 */
export interface D3PChartOptions extends D3PObjectOptions {
  /** Element or CSS selector receiving the SVG. */
  container: Element | string
  /** Fixed width; omitted = follow the container. */
  width?: number
  /** Fixed height; omitted = follow the container. */
  height?: number
  /**
   * The room around the plot, in pixels, for the tick labels of the axes: the sides you leave out keep their default. Titles and legends take their room on top of it.
   */
  margin?: Partial<D3PMargin>
  /** The name of the chart, to tell several apart in messages and event names (`chart-` and its number by default). */
  name?: string
  /** Debounce of container-driven resizes (default 0 = immediate). */
  resizeDebounceMs?: number
}

/**
 * Typed table of per-chart dynamic events (`chart.event(name)`). Modules extend it through
 * declaration merging, e.g. `declare module 'd3pict' { interface D3PChartEventMap { foo: Foo } }`.
 */
export interface D3PChartEventMap {
  /** Someone needs an interaction area and none is registered (adapters may create one). */
  needInteractionArea: D3PChart
  // mouse events, emitted by the interaction area
  /** The button went down on the chart. */
  mousedown: D3PPointerEvent
  /** The pointer moved over the chart. */
  mousemove: D3PPointerEvent
  /** The button was released. */
  mouseup: D3PPointerEvent
  /** The pointer left the chart. */
  mouseleave: D3PPointerEvent
  /** The wheel turned over the chart. */
  wheel: D3PWheelEvent
  /** The pointer is dragged with the button down. */
  drag: D3PDragEvent
  /** The drag ended: the button was released. */
  dragend: D3PDragEvent
  // tooltip / legend, emitted by their managers
  /** The tooltip was shown, with this content. */
  tooltipShow: D3PTooltipData
  /** The tooltip was hidden. */
  tooltipHide: void
  /** The legend changed: it carries what it lists. */
  legendChanged: D3PLegend
}

/**
 * The groups of the svg a chart draws in, from back to front: background, axes, data, annotations, markers, overlay, frame (around the plot) and interaction.
 */
export interface D3PChartLayers {
  /** The group behind everything: grids, bands. */
  background: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The group that holds the axes. */
  axis: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The group that holds the data; it is clipped to the plot. */
  dataRoot: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The groups of the data: behind, among and in front of the other renderers. */
  data: Record<'back' | 'middle' | 'front', d3.Selection<SVGGElement, unknown, null, undefined>>
  /** The group that holds the annotations. */
  annotationRoot: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The groups of the annotations: behind, among and in front of the other annotations. */
  annotation: Record<'back' | 'middle' | 'front', d3.Selection<SVGGElement, unknown, null, undefined>>
  /** What marks the point under the pointer (dots, outlines): above the data, below the cursor and the tooltip. */
  markers: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The group above the markers: the cursor, the tooltip. */
  overlay: d3.Selection<SVGGElement, unknown, null, undefined>
  /** In the coordinates of the svg, not of the plot: what sits around the plot (titles, legends). */
  frame: d3.Selection<SVGGElement, unknown, null, undefined>
  /** The group that holds the interaction area and what takes the pointer. */
  interactionRoot: d3.Selection<SVGGElement, unknown, null, undefined>
  /**
   * The groups of the interaction: behind, among and in front of the other objects that take the pointer.
   */
  interaction: Record<'back' | 'middle' | 'front', d3.Selection<SVGGElement, unknown, null, undefined>>
}

const DEFAULT_MARGIN: D3PMargin = { top: 20, right: 20, bottom: 40, left: 60 }

/**
 * A chart: an `svg` in a container, with the margins around its plot, a layout for titles and legends, and the services that objects use (the axes, the renderers, the coordinate systems, the interaction area).
 *
 * Nothing is drawn until objects are attached to it: axes, renderers, tools, a cursor, a tooltip.
 */
export class D3PChart extends D3PObject<{ resized: { width: number; height: number } }> implements D3PRenderTarget {
  private static counter = 0

  /** A number that identifies the chart: 1 for the first one created. */
  readonly id = ++D3PChart.counter
  /** The name of the chart. */
  readonly name: string
  /** The margin the chart was given (room for the tick labels of the axes). */
  readonly baseMargin: Readonly<D3PMargin>
  /** The room around the plot: titles, legends... reserve strips of it. */
  readonly layout: D3PLayout
  /** The element the chart was created in. */
  readonly container: Element
  /** The services of the chart (axes, renderers, coordinate systems, interaction area, probe...). */
  readonly services: D3PServiceRegistry
  /** The axes of the chart: add, remove and find them (`chart.axes.getXAxis('time')`). */
  readonly axes: D3PAxisManager
  /** The coordinate systems of the chart (cartesian by default, polar if asked). */
  readonly coords: D3PCoordinates
  /** The series renderers of the chart. */
  readonly renderers: D3PSeriesRendererManager
  /** The groups of the svg that objects draw in. */
  readonly layer: D3PChartLayers

  /** Width of the chart in pixels, margins included. */
  width: number
  /** Height of the chart in pixels, margins included. */
  height: number
  /** Width of the plot in pixels: the chart without its margins. */
  innerWidth: number
  /** Height of the plot in pixels: the chart without its margins. */
  innerHeight: number

  private readonly autoWidth: boolean
  private readonly autoHeight: boolean
  private readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
  private readonly root: d3.Selection<SVGGElement, unknown, null, undefined>
  /** `url(#id)` of the clip path of the plot area: what is drawn with it does not go out of the plot. */
  readonly plotClip: string
  private readonly clipRect: d3.Selection<SVGRectElement, unknown, null, undefined>
  /** The `<defs>` of the svg: coordinate systems register their own clip paths there. */
  readonly defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  private readonly dynamicEvents = new Map<string, symbol>()
  private observer: ResizeObserver | undefined
  private resizeTimer: ReturnType<typeof setTimeout> | undefined
  private restoreContainerPosition: (() => void) | undefined

  constructor(opts: D3PChartOptions) {
    super(`chart[${D3PChart.counter + 1}${opts.name ? '-' + opts.name : ''}]`, ['resized'], opts.bus)
    getRenderManager(this.bus)
    const container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container
    if (!container) throw new Error(`[d3pict] chart container not found: ${String(opts.container)}`)
    this.container = container
    this.name = opts.name ?? `chart-${this.id}`
    this.baseMargin = Object.freeze({ ...DEFAULT_MARGIN, ...opts.margin })
    this.layout = new D3PLayout(this)
    this.autoWidth = opts.width === undefined
    this.autoHeight = opts.height === undefined
    this.width = opts.width ?? (container.clientWidth || 800)
    this.height = opts.height ?? (container.clientHeight || 600)
    this.innerWidth = Math.max(0, this.width - this.baseMargin.left - this.baseMargin.right)
    this.innerHeight = Math.max(0, this.height - this.baseMargin.top - this.baseMargin.bottom)

    this.services = new D3PServiceRegistry(this.bus, this.name)
    this.axes = new D3PAxisManager(this)
    this.coords = new D3PCoordinates(this)
    this.renderers = new D3PSeriesRendererManager(this)
    this.services.provide(D3P_AXES, this.axes)
    this.services.provide(D3P_COORDS, this.coords)
    this.services.provide(D3P_RENDERERS, this.renderers)

    const clipId = `clip-${this.id}-${Math.random().toString(36).slice(2, 8)}`
    this.svg = d3
      .select(container)
      .append('svg')
      .attr('class', 'd3pict')
      .attr('width', this.autoWidth ? '100%' : this.width)
      .attr('height', this.autoHeight ? '100%' : this.height)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      // not `inline`: the line-height gap under an inline svg would add a few pixels to an
      // auto-height container at every measure
      .style('display', 'block')
    if (this.autoWidth && this.autoHeight) this.detachSvgFromLayout(container)
    this.defs = this.svg.append('defs')
    this.clipRect = this.defs
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.innerWidth)
      .attr('height', this.innerHeight)
    this.root = this.svg.append('g').attr('transform', `translate(${this.baseMargin.left},${this.baseMargin.top})`)

    const g = (parent: d3.Selection<SVGGElement, unknown, null, undefined>, cls: string) => parent.append('g').attr('class', cls)
    const triple = (parent: d3.Selection<SVGGElement, unknown, null, undefined>, prefix: string) => ({
      back: g(parent, `${prefix}-back`),
      middle: g(parent, `${prefix}-middle`),
      front: g(parent, `${prefix}-front`),
    })
    const background = g(this.root, 'layer-background')
    const axis = g(this.root, 'layer-axis')
    this.plotClip = `url(#${clipId})`
    const dataRoot = g(this.root, 'layer-data').attr('clip-path', this.plotClip)
    const data = triple(dataRoot, 'layer-data')
    const annotationRoot = g(this.root, 'layer-annotation')
    const annotation = triple(annotationRoot, 'layer-annotation')
    const markers = g(this.root, 'layer-markers')
    const overlay = g(this.root, 'layer-overlay')
    const interactionRoot = g(this.root, 'layer-interaction')
    const interaction = triple(interactionRoot, 'layer-interaction')
    const frame = this.svg.append('g').attr('class', 'layer-frame')
    this.layer = { background, axis, dataRoot, data, annotationRoot, annotation, markers, overlay, frame, interactionRoot, interaction }

    if ((this.autoWidth || this.autoHeight) && typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.onContainerResize(opts.resizeDebounceMs ?? 0))
      this.observer.observe(container)
    }
  }

  /** Group in which everything is drawn, in inner coordinates. */
  getRenderTarget(): d3.Selection<SVGGElement, unknown, null, undefined> {
    return this.root
  }

  /** The `svg` element of the chart. */
  getSvg(): SVGSVGElement {
    return this.svg.node()!
  }

  /**
   * Event owned by this chart and addressed by name (memoized). It lets any module address an
   * event to this chart on a shared bus; its payload type comes from {@link D3PChartEventMap}.
   */
  event<K extends keyof D3PChartEventMap>(name: K): D3PEvent<D3PChartEventMap[K]>
  event<P = unknown>(name: string): D3PEvent<P>
  event(name: string): symbol {
    let s = this.dynamicEvents.get(name)
    if (!s) this.dynamicEvents.set(name, (s = d3pEvent(`${this.e.resized.description?.split('.')[0]}.${name}`)))
    return s
  }

  /**
   * Emits an event of this chart on its bus (`mousemove`, `wheel`, `tooltipShow`...). Objects listen with `chart.event(name)`.
   */
  emitEvent<K extends keyof D3PChartEventMap>(name: K, payload: D3PChartEventMap[K]): void {
    void (this.bus.emit as (e: symbol, p?: unknown) => Promise<void>)(this.event(name), payload)
  }

  /** Registers a service under its key, for the other objects of the chart to find. */
  provide<T>(key: D3PServiceKey<T>, service: T): void {
    this.services.provide(key, service)
  }
  /** The service of that key, or `undefined` if it was not provided (`chart.get(D3P_PROBE)`). */
  get<T>(key: D3PServiceKey<T>): T | undefined {
    return this.services.get(key)
  }
  /** The service of that key. Throws an error if it was not provided. */
  require<T>(key: D3PServiceKey<T>): T {
    return this.services.require(key)
  }

  /**
   * A fully automatic chart takes its size from its container, so the svg must never take part
   * in the container's own sizing: otherwise a container whose height is not set by CSS would
   * follow the svg, which follows the container, and grow forever.
   */
  private detachSvgFromLayout(container: Element) {
    if (container instanceof HTMLElement && getComputedStyle(container).position === 'static') {
      container.style.position = 'relative'
      this.restoreContainerPosition = () => (container.style.position = '')
    }
    this.svg.style('position', 'absolute').style('inset', '0')
  }

  private onContainerResize(debounce: number) {
    if (this.isDestroying) return
    const apply = () => {
      this.resizeTimer = undefined
      if (this.isDestroying) return
      const w = this.autoWidth ? this.container.clientWidth : this.width
      const h = this.autoHeight ? this.container.clientHeight : this.height
      if (w > 0 && h > 0 && (w !== this.width || h !== this.height)) this.resize(w, h)
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    if (debounce > 0) this.resizeTimer = setTimeout(apply, debounce)
    else apply()
  }

  /**
   * Resize the chart and announce `resized`. The chart redraws nothing itself: every attached
   * object reacts to the event.
   */
  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    if (!this.autoWidth) this.svg.attr('width', width)
    if (!this.autoHeight) this.svg.attr('height', height)
    this.svg.attr('viewBox', `0 0 ${width} ${height}`)
    this.relayout()
  }

  /** The margins, strips of the layout included: where the plot starts, and how much room is left around it. */
  get margin(): Readonly<D3PMargin> {
    const r = this.layout.reserved()
    const l = this.layout
    return { top: l.inner('top') + r.top, right: l.inner('right') + r.right, bottom: l.inner('bottom') + r.bottom, left: l.inner('left') + r.left }
  }

  /** Recompute the plot from the size of the chart and its margins, and announce `resized`. */
  relayout(): void {
    const m = this.margin
    this.innerWidth = Math.max(0, this.width - m.left - m.right)
    this.innerHeight = Math.max(0, this.height - m.top - m.bottom)
    this.root.attr('transform', `translate(${m.left},${m.top})`)
    this.clipRect.attr('width', this.innerWidth).attr('height', this.innerHeight)
    this.fire(this.e.resized, { width: this.width, height: this.height })
  }

  // ----- exports -----

  /** The chart as the text of an SVG file. */
  exportSVG(): string {
    const node = this.getSvg().cloneNode(true) as SVGSVGElement
    node.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    node.setAttribute('width', String(this.width))
    node.setAttribute('height', String(this.height))
    node.removeAttribute('style') // layout styling of the live svg
    return new XMLSerializer().serializeToString(node)
  }

  /** Saves the chart as an SVG file. The browser downloads it as `filename`. */
  downloadSVG(filename = 'chart.svg'): void {
    download(new Blob([this.exportSVG()], { type: 'image/svg+xml;charset=utf-8' }), filename)
  }

  /** Data URL of a PNG rendering of the chart. */
  exportPNG(scale = 2): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([this.exportSVG()], { type: 'image/svg+xml;charset=utf-8' }))
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = this.width * scale
        canvas.height = this.height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return reject(new Error('[d3pict] 2D canvas context unavailable'))
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('[d3pict] failed to load the SVG as an image'))
      }
      img.src = url
    })
  }

  /** Saves the chart as a PNG image, `scale` times its size. The browser downloads it as `filename`. */
  async downloadPNG(filename = 'chart.png', scale = 2): Promise<void> {
    const dataUrl = await this.exportPNG(scale)
    const blob = await (await fetch(dataUrl)).blob()
    download(blob, filename)
  }

  protected override onDestroy(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    this.observer?.disconnect()
    this.svg.remove()
    this.restoreContainerPosition?.()
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
