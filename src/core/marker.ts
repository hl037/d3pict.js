import * as d3 from 'd3'
import type { D3PChart } from './chart'
import type { D3PPointerEvent } from './pointer'
import type { D3PProbeHit } from './probe'
import type { D3PSeriesRenderer } from './renderers/base'
import { D3P_TRANSITION_MS } from './renderers/base'

/**
 * A marker shows what a renderer found under the pointer: a dot on a point, an outline around a
 * bar, a slice pulled out. Each renderer provides a default one (or none) and can be given
 * another; the probe of the chart calls `show` and `hide` as the pointer moves.
 */
export interface D3PMarker {
  /** The marker is a hover effect on its own: it asks for an interaction area, where dots wait for a tooltip or a cursor to ask. */
  readonly interactive?: boolean
  /** The renderer has a hit for the pointer. */
  show(chart: D3PChart, hit: D3PProbeHit, event: D3PPointerEvent): void
  /** The renderer has nothing under the pointer (or the pointer left the chart). */
  hide(chart: D3PChart): void
  /** Drop everything drawn on `chart`, at once. */
  remove(chart: D3PChart): void
}

// ---------------------------------------------------------------------------
// Dot
// ---------------------------------------------------------------------------

/**
 * Options of a dot marker: its radius, its stroke width and whether it overshoots when it appears.
 */
export interface D3PDotMarkerOptions {
  /** Radius of the dot, in pixels (4 by default). */
  radius?: number
  /** Width of the ring around the dot, in pixels (2 by default; 0 for none). */
  strokeWidth?: number
  /** The dot overshoots its size when it appears (default true). */
  overshoot?: boolean
}

/**
 * A dot on the data point the pointer is closest to. When the point sits on a base (a range
 * area, a layer of a stack: `hit.base`), a second dot marks the base and a segment links the two.
 */
export class D3PDotMarker implements D3PMarker {
  /** Radius of the dot, in pixels. */
  radius: number
  /** Width of the ring around the dot, in pixels. */
  strokeWidth: number
  /** Whether the dot goes beyond its size and comes back when it appears. */
  overshoot: boolean
  private readonly shown = new Map<
    D3PChart,
    { group: d3.Selection<SVGGElement, unknown, null, undefined>; link: d3.Selection<SVGLineElement, unknown, null, undefined>; top: d3.Selection<SVGCircleElement, unknown, null, undefined>; base?: d3.Selection<SVGCircleElement, unknown, null, undefined> }
  >()

  constructor(
    /** The renderer whose points the marker shows. */
    readonly renderer: D3PSeriesRenderer,
    opts: D3PDotMarkerOptions = {},
  ) {
    this.radius = opts.radius ?? 4
    this.strokeWidth = opts.strokeWidth ?? 2
    this.overshoot = opts.overshoot ?? true
  }

  show(chart: D3PChart, hit: D3PProbeHit, event: D3PPointerEvent): void {
    const top = this.renderer.projectTo(chart, hit.x, hit.y, event)
    if (!top) return this.hide(chart)
    const base = hit.base === undefined ? undefined : this.renderer.projectTo(chart, hit.x, hit.base, event)
    let parts = this.shown.get(chart)
    if (!parts) {
      const group = chart.layer.markers.append('g').attr('class', 'series-marker-group').style('pointer-events', 'none')
      const link = group.append('line').attr('class', 'series-marker-link').attr('opacity', 0).attr('x1', top.x).attr('y1', top.y).attr('x2', top.x).attr('y2', top.y) // starts folded on the dot, like the dots
      const dot = () => group.append('circle').attr('class', 'series-marker').attr('r', 0).attr('opacity', 0).attr('stroke', '#fff').attr('cx', top.x).attr('cy', top.y)
      parts = { group, link, top: dot() }
      this.shown.set(chart, parts)
    }
    const ease = this.overshoot ? d3.easeBackOut.overshoot(1.5) : d3.easeQuadOut
    // the second dot only exists while there is a base to mark
    if (base && !parts.base) {
      parts.base = parts.group.append('circle').attr('class', 'series-marker').attr('r', 0).attr('opacity', 0).attr('stroke', '#fff').attr('cx', top.x).attr('cy', top.y)
    } else if (!base && parts.base) {
      parts.base.interrupt().remove()
      parts.base = undefined
    }
    const place = (dot: d3.Selection<SVGCircleElement, unknown, null, undefined>, at: { x: number; y: number } | undefined) =>
      dot
        .interrupt()
        .attr('stroke-width', this.strokeWidth)
        .attr('fill', hit.color)
        .transition()
        .duration(D3P_TRANSITION_MS)
        .ease(ease)
        .attr('cx', at?.x ?? top.x)
        .attr('cy', at?.y ?? top.y)
        .attr('opacity', at ? 1 : 0)
        .attr('r', at ? this.radius : 0)
    place(parts.top, top)
    if (parts.base) place(parts.base, base)
    const end = base ?? top
    parts.link
      .interrupt()
      .attr('stroke', hit.color)
      .attr('stroke-width', this.strokeWidth)
      .transition()
      .duration(D3P_TRANSITION_MS)
      .ease(ease) // the same as the dots it joins
      .attr('x1', top.x)
      .attr('y1', top.y)
      .attr('x2', end.x)
      .attr('y2', end.y)
      .attr('opacity', base ? 0.6 : 0)
  }

  hide(chart: D3PChart): void {
    const parts = this.shown.get(chart)
    if (!parts) return
    this.shown.delete(chart)
    parts.group.interrupt().selectAll('*').interrupt()
    parts.group.transition().duration(D3P_TRANSITION_MS).ease(d3.easeQuadIn).attr('opacity', 0).remove()
  }

  remove(chart: D3PChart): void {
    this.shown.get(chart)?.group.interrupt().remove()
    this.shown.delete(chart)
  }
}

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/** Options of a cell marker: its fill, its fill opacity, its stroke and its stroke width. */
export interface D3PCellMarkerOptions {
  /** Fill of the outline (white by default). */
  fill?: string
  /** Opacity of the fill (0.25 by default). */
  fillOpacity?: number
  /** Color of the outline (black by default). */
  stroke?: string
  /** Width of the outline, in pixels (1.5 by default). */
  strokeWidth?: number
}

/** Outlines the cell of the hit (a bar, a heatmap cell), in any coordinate system. */
export class D3PCellMarker implements D3PMarker {
  /** Fill of the outline. */
  fill: string
  /** Opacity of the fill. */
  fillOpacity: number
  /** Color of the outline. */
  stroke: string
  /** Width of the outline, in pixels. */
  strokeWidth: number
  private readonly shapes = new Map<D3PChart, d3.Selection<SVGGElement, unknown, null, undefined>>()

  constructor(opts: D3PCellMarkerOptions = {}) {
    this.fill = opts.fill ?? '#fff'
    this.fillOpacity = opts.fillOpacity ?? 0.25
    this.stroke = opts.stroke ?? '#000'
    this.strokeWidth = opts.strokeWidth ?? 1.5
  }

  show(chart: D3PChart, hit: D3PProbeHit): void {
    const cell = hit.cell
    if (!cell || !hit.system) return this.hide(chart)
    const shape = hit.system.cellShape(chart, cell.a0, cell.a1, cell.b0, cell.b1)
    let group = this.shapes.get(chart)
    if (!group) {
      group = chart.layer.markers.append('g').attr('class', 'cell-marker').style('pointer-events', 'none')
      this.shapes.set(chart, group)
    }
    const node = group
      .selectAll<SVGElement, typeof shape>(shape.tag)
      .data([shape])
      .join(shape.tag)
      .attr('fill', this.fill)
      .attr('fill-opacity', this.fillOpacity)
      .attr('stroke', this.stroke)
      .attr('stroke-width', this.strokeWidth)
    if (shape.tag === 'rect') node.attr('x', shape.x).attr('y', shape.y).attr('width', shape.width).attr('height', shape.height)
    else node.attr('d', shape.d).attr('transform', shape.transform ?? null)
  }

  hide(chart: D3PChart): void {
    this.remove(chart)
  }

  remove(chart: D3PChart): void {
    this.shapes.get(chart)?.remove()
    this.shapes.delete(chart)
  }
}

// ---------------------------------------------------------------------------
// Custom
// ---------------------------------------------------------------------------

/** A marker made of functions: for renderers whose highlight is part of their own drawing (a slice pulled out of a pie). */
export class D3PFunctionMarker implements D3PMarker {
  constructor(
    private readonly handlers: {
      show(chart: D3PChart, hit: D3PProbeHit): void
      hide(chart: D3PChart): void
      interactive?: () => boolean
    },
  ) {}

  get interactive(): boolean {
    return this.handlers.interactive?.() ?? true
  }

  show(chart: D3PChart, hit: D3PProbeHit): void {
    this.handlers.show(chart, hit)
  }
  hide(chart: D3PChart): void {
    this.handlers.hide(chart)
  }
  remove(chart: D3PChart): void {
    this.handlers.hide(chart)
  }
}
