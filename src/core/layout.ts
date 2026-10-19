import type { D3PChart, D3PMargin } from './chart'
import { D3PObject } from './object'

/** A side of the plot. */
export type D3PSide = 'top' | 'right' | 'bottom' | 'left'

/** What a band covers along its side: the whole chart, or only the plot (between the margins). */
export type D3PBandSpan = 'chart' | 'plot'

/**
 * A strip along one side of the chart, taken from the room of the plot. Titles, legends and any
 * component of your own that has to sit around the plot reserve one, and draw in its `rect()`.
 */
export class D3PBand {
  constructor(
    private readonly layout: D3PLayout,
    /** The side the strip is on. */
    readonly side: D3PSide,
    private _size: number,
    /** Along the chart (`chart`) or along the plot (`plot`). */
    readonly span: D3PBandSpan,
    /** Stacking rank: the lower, the further from the plot. */
    readonly order: number,
  ) {}

  /** The width of the strip (the height for the top and the bottom), in pixels. */
  get size(): number {
    return this._size
  }
  /** Change the width (or height) of the strip: the plot gives or takes the difference. */
  set size(value: number) {
    if (value === this._size) return
    this._size = Math.max(0, value)
    this.layout.changed()
  }

  /** Give the strip back to the plot. */
  release(): void {
    this.layout.release(this)
  }

  /** Where the strip is, in the coordinates of the svg (the whole chart, margins included). */
  rect(): { x: number; y: number; width: number; height: number } {
    return this.layout.rectOf(this)
  }
}

/** A distance the plot must keep from the edge of the chart on one side, whatever else is there. */
export class D3PRequirement {
  constructor(
    private readonly layout: D3PLayout,
    /** The side the plot keeps its distance from. */
    readonly side: D3PSide,
    private _distance: number,
  ) {}

  /** The distance, in pixels. */
  get distance(): number {
    return this._distance
  }
  /** Changes the distance: the plot is laid out again. */
  set distance(value: number) {
    if (value === this._distance) return
    this._distance = Math.max(0, value)
    this.layout.changed()
  }

  /** Gives the distance up: the plot may come closer to the edge. */
  release(): void {
    this.layout.releaseRequirement(this)
  }
}

/**
 * The room around the plot of one chart. The chart has margins of its own (the `margin` option,
 * for the tick labels of the axes); bands reserved here come on top of them. The bands of one
 * side stack by `order` (the lowest is the outermost), and by the time they were reserved when
 * their orders are the same. The plot is what remains.
 */
export class D3PLayout extends D3PObject<{ changed: void }> {
  private readonly bands: D3PBand[] = []
  private readonly requirements: D3PRequirement[] = []

  constructor(/** The chart whose room it divides. */ readonly chart: D3PChart) {
    super(`${chart.name}.layout`, ['changed'], chart.bus)
    this.subs.add(this.bus.on(chart.e.destroyed, () => this.destroy()))
  }

  /**
   * Reserve a strip of `size` pixels along `side`. `order` ranks it among the strips of its side:
   * the lowest is the outermost. The standard components use 0 for a title, 1 for a legend (the
   * default) and 2 for the title of an axis, which is the closest to the plot.
   */
  reserve(side: D3PSide, size: number, span: D3PBandSpan = 'plot', order = 1): D3PBand {
    const band = new D3PBand(this, side, Math.max(0, size), span, order)
    this.bands.push(band)
    this.bands.sort((a, b) => a.order - b.order) // stable: same order, the first reserved stays outside
    this.changed()
    return band
  }

  /**
   * Ask for the plot to be at least `distance` pixels from the edge of the chart on `side`, the
   * strips not counted. Requirements do not add up: the margin is the largest of them and of the
   * `margin` of the chart. It is how a title that sits against its axis asks for the room the
   * axis and the title need together, however wide the tick labels turn out to be.
   */
  require(side: D3PSide, distance: number): D3PRequirement {
    const requirement = new D3PRequirement(this, side, Math.max(0, distance))
    this.requirements.push(requirement)
    this.changed()
    return requirement
  }

  /** @internal */
  releaseRequirement(requirement: D3PRequirement): void {
    const i = this.requirements.indexOf(requirement)
    if (i < 0) return
    this.requirements.splice(i, 1)
    this.changed()
  }

  /** The margin of one side without the strips: what the chart was given, or what a requirement asks for. */
  inner(side: D3PSide): number {
    let distance = this.chart.baseMargin[side]
    for (const r of this.requirements) if (r.side === side) distance = Math.max(distance, r.distance)
    return distance
  }

  /** @internal */
  release(band: D3PBand): void {
    const i = this.bands.indexOf(band)
    if (i < 0) return
    this.bands.splice(i, 1)
    this.changed()
  }

  /** Total of the strips reserved along each side. */
  reserved(): D3PMargin {
    const total = { top: 0, right: 0, bottom: 0, left: 0 }
    for (const b of this.bands) total[b.side] += b.size
    return total
  }

  /** @internal The plot has a new size: the chart recomputes its inner area and tells everyone. */
  changed(): void {
    if (this.isDestroying) return
    this.chart.relayout()
    this.fire(this.e.changed)
  }

  /** @internal */
  rectOf(band: D3PBand): { x: number; y: number; width: number; height: number } {
    const { chart } = this
    const margin = chart.margin
    // the strips of the same side that are further out
    let outside = 0
    for (const b of this.bands) {
      if (b === band) break
      if (b.side === band.side) outside += b.size
    }
    const horizontal = band.side === 'top' || band.side === 'bottom'
    const from = band.span === 'plot' ? (horizontal ? margin.left : margin.top) : 0
    const to = band.span === 'plot' ? (horizontal ? chart.width - margin.right : chart.height - margin.bottom) : horizontal ? chart.width : chart.height
    const along = Math.max(0, to - from)
    switch (band.side) {
      case 'top':
        return { x: from, y: outside, width: along, height: band.size }
      case 'bottom':
        return { x: from, y: chart.height - outside - band.size, width: along, height: band.size }
      case 'left':
        return { x: outside, y: from, width: band.size, height: along }
      case 'right':
        return { x: chart.width - outside - band.size, y: from, width: band.size, height: along }
    }
  }

  protected override onDestroy(): void {
    this.bands.length = 0
    this.requirements.length = 0
  }
}
