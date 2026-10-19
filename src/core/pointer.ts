import type { D3PAxis, D3PAxisSnapshot } from './axis'
import type { D3PChart } from './chart'
import type { D3PCoordinateSystem, D3PSystemSnapshot } from './coords'
import { D3PProjectionMemo, D3PViewportPoint } from './projection'

/**
 * A mouse event on a chart, as the interaction area emits it. It carries the pixel under the
 * pointer and is the projection cache of that event: everything that asks `axis.projectFrom(event.point, undefined, event)`
 * (the tooltip, the cursor, the markers, a tool) shares one computation, and nothing is computed
 * if nobody asks. Projections read the live state of the chart.
 *
 * An event is valid for the moment it was emitted, up to the next redraw. To compare the live
 * state with the one of a gesture's start, take a {@link D3PViewSnapshot} with `snapshot()`
 * instead of keeping the event.
 */
export class D3PPointerEvent extends D3PProjectionMemo {
  /** The pixel under the pointer, in the inner area of the chart. */
  readonly point: D3PViewportPoint

  constructor(
    /** The chart the pointer is on. */
    readonly chart: D3PChart,
    /** X of the pointer, in pixels, in the plot. */
    x: number,
    /** Y of the pointer, in pixels, in the plot. */
    y: number,
    /** The DOM event. */
    readonly original: MouseEvent,
  ) {
    super()
    this.point = new D3PViewportPoint(chart, x, y)
  }

  /** X of the pointer, in pixels, in the plot. */
  get x(): number {
    return this.point.x
  }
  /** Y of the pointer, in pixels, in the plot. */
  get y(): number {
    return this.point.y
  }

  /** Freeze the axes and systems of the chart as they are now. */
  snapshot(): D3PViewSnapshot {
    return new D3PViewSnapshot(this.chart)
  }
}

/**
 * `wheel`: the pointer, and how far the wheel turned.
 */
export class D3PWheelEvent extends D3PPointerEvent {
  constructor(chart: D3PChart, x: number, y: number, original: WheelEvent, /** How far the wheel turned (the vertical delta of the event). */ readonly delta: number = original.deltaY) {
    super(chart, x, y, original)
  }
}

/** `drag` and `dragend`: the pointer, and where the button went down. */
export class D3PDragEvent extends D3PPointerEvent {
  constructor(
    /** The chart the pointer is on. */
    chart: D3PChart,
    /** X of the pointer, in pixels, in the plot. */
    x: number,
    /** Y of the pointer, in pixels, in the plot. */
    y: number,
    original: MouseEvent,
    /** Where the drag started. */
    readonly start: D3PViewportPoint,
  ) {
    super(chart, x, y, original)
  }

  /** Distance of the pointer from where the drag started, on x, in pixels. */
  get dx(): number {
    return this.x - this.start.x
  }
  /** Distance of the pointer from where the drag started, on y, in pixels. */
  get dy(): number {
    return this.y - this.start.y
  }
}

/**
 * The axes and coordinate systems of a chart as they were when the snapshot was taken. It
 * also is a projection cache, for the projections made through its axes and systems.
 */
export class D3PViewSnapshot extends D3PProjectionMemo {
  private readonly systems = new Map<D3PCoordinateSystem, D3PSystemSnapshot>()
  private readonly axes = new Map<D3PAxis, D3PAxisSnapshot>()

  constructor(/** The chart that was frozen. */ readonly chart: D3PChart) {
    super()
    for (const system of chart.coords.list()) this.systems.set(system, system.snapshot(chart))
    const { x, y } = chart.axes.getAxesState()
    for (const axis of [...x, ...y]) {
      const system = axis.getSystem(chart)
      const frozen = system && this.systems.get(system)
      if (frozen) this.axes.set(axis, axis.snapshot(chart, frozen))
    }
  }

  /** The snapshot of an axis, as it was when the snapshot was taken. */
  getAxis(axis: D3PAxis): D3PAxisSnapshot {
    const found = this.axes.get(axis)
    if (!found) throw new Error(`[d3pict] axis "${axis.name}" was not on chart "${this.chart.name}" when the snapshot was taken`)
    return found
  }

  /** The snapshot of a system, as it was when the snapshot was taken. */
  getSystem(system: D3PCoordinateSystem): D3PSystemSnapshot {
    const found = this.systems.get(system)
    if (!found) throw new Error(`[d3pict] system "${system.name}" was not on chart "${this.chart.name}" when the snapshot was taken`)
    return found
  }
}
