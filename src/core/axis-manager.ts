import { D3PObject } from './object'
import { d3pServiceKey } from './services'
import type { D3PAxis } from './axis'
import type { D3PChart } from './chart'

/** Key of the service that holds the axes of a chart (`chart.axes`). */
export const D3P_AXES = d3pServiceKey<D3PAxisManager>('axes')

/** The axes of a chart that are attached, by dimension. */
export interface D3PAxesState {
  /** The X axes. */
  x: D3PAxis[]
  /** The Y axes. */
  y: D3PAxis[]
}

/** Mixed filter: axis objects (by identity) and/or axis names. */
export type D3PAxisFilter = ReadonlyArray<D3PAxis | string>

/**
 * Per-chart registry of axes. Names are unique within a chart (across X and Y), since mapped
 * mouse coordinates are keyed by axis name.
 */
export class D3PAxisManager extends D3PObject<{ axesListChanged: D3PAxesState }> {
  private xs = new Map<string, D3PAxis>()
  private ys = new Map<string, D3PAxis>()
  private offs = new Map<D3PAxis, () => void>()

  constructor(/** The chart whose axes it holds. */ readonly chart: D3PChart) {
    super(`${chart.name}.axes`, ['axesListChanged'], chart.bus)
    this.subs.add(this.bus.on(chart.e.destroyed, () => this.destroy()))
  }

  /** Adds an axis to the chart. Throws an error if another axis already has its name. */
  add(axis: D3PAxis): void {
    const existing = this.xs.get(axis.name) ?? this.ys.get(axis.name)
    if (existing === axis) return
    if (existing) throw new Error(`[d3pict] an axis named "${axis.name}" already exists in chart "${this.chart.name}"`)
    ;(axis.component === 'x' ? this.xs : this.ys).set(axis.name, axis)
    this.offs.set(axis, this.bus.on(axis.e.destroyed, () => this.remove(axis)))
    this.announce()
  }

  /** Removes an axis from the chart. */
  remove(axis: D3PAxis): void {
    const map = axis.component === 'x' ? this.xs : this.ys
    if (map.get(axis.name) !== axis) return
    map.delete(axis.name)
    this.offs.get(axis)?.()
    this.offs.delete(axis)
    this.announce()
  }

  private announce() {
    if (this.isDestroying) return
    this.fire(this.e.axesListChanged, this.getAxesState())
  }

  /** Axes retained by `filter` (identity or name); no filter = everything. */
  getAxesState(filter?: D3PAxisFilter): AxesStateResult {
    const keep = (a: D3PAxis) => !filter || filter.some((f) => f === a || f === a.name)
    return { x: [...this.xs.values()].filter(keep), y: [...this.ys.values()].filter(keep) }
  }

  /** The X axes (angle axes in polar), in the order they were added. */
  getXAxes(): D3PAxis[] {
    return [...this.xs.values()]
  }
  /** The Y axes (radius axes in polar), in the order they were added. */
  getYAxes(): D3PAxis[] {
    return [...this.ys.values()]
  }
  /** The X axis of that name, if any. */
  getXAxis(name: string): D3PAxis | undefined {
    return this.xs.get(name)
  }
  /** The Y axis of that name, if any. */
  getYAxis(name: string): D3PAxis | undefined {
    return this.ys.get(name)
  }
}

type AxesStateResult = D3PAxesState
