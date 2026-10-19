import * as d3 from 'd3'

// ---------------------------------------------------------------------------
// Set diff
// ---------------------------------------------------------------------------

/**
 * What `d3pMergeArray` returns: the values that entered, left, stayed or all of them, to act on each group in turn.
 */
export interface D3PMergeResult<T> {
  /** Calls `cb` with each value that is new. */
  enter(cb: (v: T) => void): D3PMergeResult<T>
  /** Calls `cb` with each value that is gone. */
  exit(cb: (v: T) => void): D3PMergeResult<T>
  /** Calls `cb` with each value that is in both. */
  update(cb: (v: T) => void): D3PMergeResult<T>
  /** Calls `cb` with all the values, new and old. */
  all(cb: (v: T) => void): D3PMergeResult<T>
  /** All the values, new and old. */
  value(): T[]
}

/**
 * Identity diff between two arrays. With `each: false` the callbacks receive the whole
 * array once instead of each element.
 */
export function d3pMergeArray<T>(previous: readonly T[], next: readonly T[], opts: { each?: boolean } = {}): D3PMergeResult<T> {
  const each = opts.each ?? true
  const prev = new Set(previous)
  const nxt = new Set(next)
  const enter = next.filter((v) => !prev.has(v))
  const exit = previous.filter((v) => !nxt.has(v))
  const update = next.filter((v) => prev.has(v))
  const all = [...enter, ...update]
  const call = (list: T[], cb: (v: any) => void) => (each ? list.forEach(cb) : cb(list))
  const r: D3PMergeResult<T> = {
    enter: (cb) => (call(enter, cb), r),
    exit: (cb) => (call(exit, cb), r),
    update: (cb) => (call(update, cb), r),
    all: (cb) => (call(all, cb), r),
    value: () => all,
  }
  return r
}

// ---------------------------------------------------------------------------
// Mouse tracking
// ---------------------------------------------------------------------------

/**
 * A mouse event seen by `d3pTrack`: the original event, and the pointer relative to the element and to the page.
 */
export interface D3PTrackedEvent {
  /** The original mouse event. */
  original: MouseEvent
  /** Pointer relative to the target element. */
  element: { x: number; y: number }
  /** The pointer relative to the page. */
  page: { x: number; y: number }
}

/**
 * What `d3pTrack` calls during a drag: when the button goes down, when the pointer moves and when the button goes up.
 */
export interface D3PTrackingCallbacks {
  /** The button went down. */
  mouseDown?(e: D3PTrackedEvent): void
  /** The pointer moved, with the button down. */
  mouseMove?(e: D3PTrackedEvent): void
  /** The button went up. */
  mouseUp?(e: D3PTrackedEvent): void
}

/**
 * Start a drag session on `mousedown`. Moves and release are tracked on the document so the
 * gesture continues outside the element and always ends cleanly. Returns a cleanup function
 * (ending the session without calling `mouseUp`).
 */
export function d3pStartTracking(event: MouseEvent, target: Element, cb: D3PTrackingCallbacks): () => void {
  const button = event.button
  const doc = target.ownerDocument
  const wrap = (e: MouseEvent): D3PTrackedEvent => {
    const [x, y] = d3.pointer(e, target)
    return { original: e, element: { x, y }, page: { x: e.pageX, y: e.pageY } }
  }
  const cleanup = () => {
    doc.removeEventListener('mousemove', move)
    doc.removeEventListener('mouseup', up)
    doc.removeEventListener('mouseenter', move)
  }
  const end = (e: MouseEvent) => {
    cleanup()
    cb.mouseUp?.(wrap(e))
  }
  const move = (e: MouseEvent) => {
    if (!e.buttons) return end(e)
    cb.mouseMove?.(wrap(e))
  }
  const up = (e: MouseEvent) => {
    if (e.button === button) end(e)
  }
  cb.mouseDown?.(wrap(event))
  doc.addEventListener('mousemove', move)
  doc.addEventListener('mouseup', up)
  doc.addEventListener('mouseenter', move)
  return cleanup
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

/** A value of an axis domain: a number, a date or a category. */
export type D3PDomainValue = number | Date | string
/** A d3 scale usable by an axis. */
export type D3PScale = d3.AxisScale<any>
/**
 * The type of scale of an axis: continuous (`linear`, `log`, `pow`, `sqrt`, `symlog`, `time`, `utc`, `radial`) or categorical (`band`, `point`).
 */
export type D3PScaleType = 'linear' | 'log' | 'pow' | 'sqrt' | 'time' | 'utc' | 'symlog' | 'radial' | 'point' | 'band'

/** Options of a scale: the base of a log scale and the exponent of a power scale. */
export interface D3PScaleOptions {
  /** Log base (default 10). */
  base?: number
  /** Pow exponent (default 2). */
  exponent?: number
}

/** Creates the d3 scale of a type (`linear`, `log`, `time`, `band`...) with its options. */
export function d3pScaleFactory(
  type: D3PScaleType,
  opts: { domain: Iterable<D3PDomainValue>; range: [number, number] } & D3PScaleOptions,
): D3PScale {
  const domain = [...opts.domain]
  let s: any
  switch (type) {
    case 'linear': s = d3.scaleLinear(); break
    case 'log': s = d3.scaleLog().base(opts.base ?? 10); break
    case 'pow': s = d3.scalePow().exponent(opts.exponent ?? 2); break
    case 'sqrt': s = d3.scaleSqrt(); break
    case 'time': s = d3.scaleTime(); break
    case 'utc': s = d3.scaleUtc(); break
    case 'symlog': s = d3.scaleSymlog(); break
    case 'radial': s = d3.scaleRadial(); break
    case 'point': s = d3.scalePoint(); break
    case 'band': s = d3.scaleBand(); break
    default: throw new Error(`[d3pict] unknown scale type "${type}"`)
  }
  return s.domain(domain).range(opts.range)
}

/** Whether a scale can give a value back from a position (a continuous scale, not a band). */
export function d3pIsInvertible(scale: D3PScale): boolean {
  return typeof (scale as any).invert === 'function'
}

/** Whether a scale is made of bands or points: categories, not numbers. */
export function d3pIsBand(scale: D3PScale): boolean {
  return typeof (scale as any).bandwidth === 'function'
}

/**
 * Range position -> domain value. Continuous scales use `invert`; band/point scales return the
 * category whose band contains the pixel (point: the nearest category).
 */
export function d3pScaleProjectFrom(scale: D3PScale, pixel: number): D3PDomainValue | undefined {
  const s = scale as any
  if (typeof s.invert === 'function') return s.invert(pixel)
  if (typeof s.bandwidth === 'function') {
    const domain: D3PDomainValue[] = s.domain()
    const bw: number = s.bandwidth()
    if (bw === 0) {
      // point scale
      let best: D3PDomainValue | undefined
      let bestD = Infinity
      for (const d of domain) {
        const dist = Math.abs(s(d) - pixel)
        if (dist < bestD) (bestD = dist), (best = d)
      }
      const step: number = s.step?.() ?? Infinity
      return bestD <= step / 2 ? best : undefined
    }
    for (const d of domain) {
      const start: number = s(d)
      if (pixel >= start && pixel <= start + bw) return d
    }
  }
  return undefined
}

/** Numeric view of a domain value (Date -> ms); `undefined` when not numeric. */
export function d3pToNumber(v: unknown): number | undefined {
  if (v instanceof Date) return v.valueOf()
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Range position of a domain value, centered in the band for band/point scales. */
export function d3pScaleProjectTo(scale: D3PScale, value: D3PDomainValue): number | undefined {
  const p = (scale as any)(value) as number | undefined
  if (p === undefined || Number.isNaN(p)) return undefined
  return d3pIsBand(scale) ? p + (scale as any).bandwidth() / 2 : p
}

/** Tick formatter that also works for band/point scales (which have no `tickFormat`). */
export function d3pDefaultFormatter(scale: D3PScale): (v: any) => string {
  const s = scale as any
  return typeof s.tickFormat === 'function' ? s.tickFormat() : (v: unknown) => String(v)
}

// ---------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------

/**
 * How points are joined. `linear` is straight in a cartesian system and follows the curve in a
 * polar one; `straight` is a chord in both (what a radar chart needs).
 */
export type D3PCurve = 'linear' | 'straight' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter' | 'basis' | 'cardinal' | 'catmullRom' | 'natural'

/**
 * The d3 curve of a name (`linear`, `monotone`, `step`...); `linear` for an unknown or missing one.
 */
export function d3pCurveFactory(curve: D3PCurve | undefined): d3.CurveFactory {
  switch (curve) {
    case 'monotone': return d3.curveMonotoneX
    case 'step': return d3.curveStep
    case 'stepBefore': return d3.curveStepBefore
    case 'stepAfter': return d3.curveStepAfter
    case 'basis': return d3.curveBasis
    case 'cardinal': return d3.curveCardinal
    case 'catmullRom': return d3.curveCatmullRom
    case 'natural': return d3.curveNatural
    default: return d3.curveLinear
  }
}
