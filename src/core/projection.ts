import type { D3PChart } from './chart'

/**
 * Projections between the three spaces of a chart.
 *
 * - **domain**: values of the data, along an axis (a date, a category, 42.5...);
 * - **range**: units of a coordinate system (cartesian: pixels; polar: radians and distance to the center);
 * - **pixel**: the inner area of the chart (the viewport of the interaction area).
 *
 * `domain —axis→ range —system→ pixel`. `projectTo` goes toward the pixels, `projectFrom` comes
 * back from them. Both accept an optional {@link D3PProjectionCache} so that a result asked
 * several times (by the tooltip, the cursor, the markers...) is computed once.
 */

/** A point of the viewport: a pixel of the inner area of `chart`. */
export class D3PViewportPoint {
  constructor(
    /** The chart the point is on. */
    readonly chart: D3PChart,
    /** X in pixels, in the plot. */
    readonly x: number,
    /** Y in pixels, in the plot. */
    readonly y: number,
  ) {}
}

/**
 * Remembers results by projector (an axis, a system, a renderer...), chart and key. A projector
 * asks `memo` instead of computing: the cache computes on the first request only.
 */
export interface D3PProjectionCache {
  /** The value of `compute` for these arguments: computed once, then kept as long as the cache is. */
  memo<T>(projector: object, chart: D3PChart, key: unknown, compute: () => T): T
}

/** `cache.memo(...)` when there is a cache, a plain computation otherwise. */
export function d3pMemo<T>(cache: D3PProjectionCache | undefined, projector: object, chart: D3PChart, key: unknown, compute: () => T): T {
  return cache ? cache.memo(projector, chart, key, compute) : compute()
}

/** Stable text for a key made of numbers, dates, strings and lists of them. */
function canonical(key: unknown): string {
  if (key instanceof Date) return `d${+key}`
  if (Array.isArray(key)) return `[${key.map(canonical).join(',')}]`
  if (typeof key === 'string') return `s${key}`
  if (typeof key === 'object' && key !== null) return `o${JSON.stringify(key)}`
  return `${typeof key}${String(key)}`
}

/** The plain cache: a map of maps, kept as long as the object is. */
export class D3PProjectionMemo implements D3PProjectionCache {
  private readonly results = new WeakMap<object, Map<D3PChart, Map<string, unknown>>>()

  /** The value of `compute` for these arguments: computed once, then kept as long as the event is. */
  memo<T>(projector: object, chart: D3PChart, key: unknown, compute: () => T): T {
    let byChart = this.results.get(projector)
    if (!byChart) this.results.set(projector, (byChart = new Map()))
    let byKey = byChart.get(chart)
    if (!byKey) byChart.set(chart, (byKey = new Map()))
    const k = canonical(key)
    if (byKey.has(k)) return byKey.get(k) as T
    const value = compute()
    byKey.set(k, value)
    return value
  }
}
