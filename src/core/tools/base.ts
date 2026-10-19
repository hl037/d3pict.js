import type { D3PBus } from '../bus'
import type { D3PAxis } from '../axis'
import type { D3PAxisFilter } from '../axis-manager'
import type { D3PChart } from '../chart'
import type { D3PSystemProjector } from '../coords'
import { d3pRequireInteractionArea } from '../interaction'
import { D3PAttachable } from '../object'
import type { D3PProjectionCache, D3PViewportPoint } from '../projection'
import { d3pToNumber, type D3PDomainValue } from '../util'

/** Options of a tool: the bus and the axes it acts on (all by default). */
export interface D3PToolOptions {
  /** The bus the tool uses (the global bus by default). */
  bus?: D3PBus
  /** Axes (objects or names) the tool acts on; omitted = every axis of the chart. */
  axes?: D3PAxisFilter
}

/**
 * Base of the tools. A tool is active on a chart iff it is attached to it; it resolves its
 * axes on every event and acts only by writing axis domains.
 */
export abstract class D3PTool<D = {}, M extends object = {}> extends D3PAttachable<D, M> {
  /** The axes the tool is restricted to (objects or names), if any. */
  readonly axes: D3PAxisFilter | undefined

  constructor(/** The name of the tool in its toolbox (`pan`, `wheel-zoom`...). */ readonly name: string, eventNames: readonly (keyof M & string)[], opts: D3PToolOptions = {}) {
    super(`tool[${name}]`, eventNames, opts.bus)
    this.axes = opts.axes
  }

  /** The axes the tool acts on: the ones it is restricted to, or all those of the chart. */
  protected resolveAxes(chart: D3PChart): D3PAxis[] {
    const s = chart.axes.getAxesState(this.axes)
    return [...s.x, ...s.y]
  }

  /**
   * Position of `point` along `axis`, in the range units of its system (pixels for a cartesian
   * axis, radians or distance to the center for a polar one). Not limited to the system, so a
   * drag keeps working when the pointer leaves it. `system` defaults to the live one of the
   * axis; a gesture that compares with its start passes the system of its snapshot.
   */
  protected rangeOf(axis: D3PAxis, point: D3PViewportPoint, system: D3PSystemProjector | undefined = axis.getSystem(point.chart), cache?: D3PProjectionCache): number | undefined {
    const u = system?.projectFrom(point, { strict: false }, cache)
    return u && (axis.component === 'x' ? u[0] : u[1])
  }

  /** Ask for an interaction area (tools driven by the mouse need one). */
  protected requireArea(chart: D3PChart) {
    d3pRequireInteractionArea(chart)
  }

  /** Whether the tool is attached to this chart and alive. */
  protected isActiveOn(chart: D3PChart): boolean {
    return !this.isDestroying && this.chartData.has(chart)
  }
}

/**
 * Whether a domain value is a number or a date: something that can be measured along an axis, as opposed to a category.
 */
export function d3pIsDomainNumeric(v: D3PDomainValue | undefined): v is number | Date {
  return d3pToNumber(v) !== undefined
}

/** Rebuild a domain bound of the same kind as `like` (Date stays Date). */
export function d3pLike(like: D3PDomainValue, n: number): D3PDomainValue {
  return like instanceof Date ? new Date(n) : n
}
