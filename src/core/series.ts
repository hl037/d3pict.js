import type { D3PBus } from './bus'
import { D3PObject } from './object'
import type { D3PAxisDomain } from './domain'
import type { D3PDomainValue } from './util'

/**
 * A point of a series: `[x, primary, ...others]`. The primary value comes second, so everything
 * that reads a point as `[x, y]` keeps working whatever the number of columns. Names and order
 * of the columns are those of the series (`series.columns`).
 */
export type D3PPoint = [x: number | string | Date, y: number, ...extra: any[]]

/** Key of an object row, or function reading a column from a row. */
export type D3PFieldAccessor = string | ((row: any, index: number) => unknown)

/**
 * What a series accepts as data: numbers, rows (arrays or objects), columns, or any iterable of them.
 */
export type D3PSeriesData =
  | number[]
  | ArrayLike<number>
  | Iterable<unknown>
  | ReadonlyArray<readonly unknown[]>
  | ReadonlyArray<Record<string, any>>
  | Record<string, ArrayLike<unknown>>

/**
 * Which columns a series has (`columns`), which one is its value (`primary`) and, for object rows and column data, where each comes from (`fields`).
 */
export interface D3PColumnSpec {
  /**
   * Names of the columns of the input; the first one is `x`. Default `['x', 'y']`. A series
   * with more columns (`['x', 'open', 'high', 'low', 'close']`) feeds renderers that need them.
   */
  columns?: readonly string[]
  /** The column read as "the value" where a single one is expected (default: the second column). */
  primary?: string
  /** For object rows and column-oriented data: where each column comes from (default: its own name). */
  fields?: Readonly<Record<string, D3PFieldAccessor>>
}

/** Order in which the columns are stored: x, the primary column, then the others. */
export function d3pColumnLayout(spec: D3PColumnSpec = {}): { input: readonly string[]; stored: readonly string[] } {
  const input = spec.columns ?? ['x', 'y']
  if (input.length < 2) throw new Error('[d3pict] a series needs at least two columns (x and a value)')
  if (new Set(input).size !== input.length) throw new Error(`[d3pict] duplicate column names in ${input.join(', ')}`)
  const primary = spec.primary ?? input[1]
  if (!input.includes(primary) || primary === input[0]) throw new Error(`[d3pict] primary column "${primary}" is not one of the value columns (${input.slice(1).join(', ')})`)
  return { input, stored: [input[0], primary, ...input.slice(1).filter((c) => c !== primary)] }
}

const nullish = (v: unknown) => v === undefined || v === null

/**
 * Columns that are not positions: a bubble's `size`, a heatmap's `value`, a `kind`, `color` or
 * `label`. The auto domain leaves them out of the Y domain unless `domainColumns` says otherwise.
 */
const NON_SPATIAL = new Set(['size', 'value', 'kind', 'color', 'label'])

/**
 * Normalize the accepted inputs to points `[x, primary, ...others]`.
 *
 * - numbers (`[3, 5, 2]`, typed arrays): `x` is the index (two columns only);
 * - positional rows (`[[x, a, b], ...]`): columns in the order of `spec.columns`;
 * - object rows (`[{ x, y }]`, or other keys / accessors through `spec.fields`);
 * - column-oriented data (`{ x: [...], y: [...] }`);
 * - any iterable of those.
 *
 * The format is detected on the first row. Object rows lacking `x` or the primary value are
 * dropped; other missing columns become `NaN`.
 */
export function d3pNormalizeSeries(data: unknown, spec: D3PColumnSpec = {}): D3PPoint[] {
  const { input, stored } = d3pColumnLayout(spec)
  const fields = spec.fields
  const accessor = (col: string): D3PFieldAccessor => fields?.[col] ?? col
  const read = (row: any, i: number, col: string) => {
    const a = accessor(col)
    return typeof a === 'function' ? a(row, i) : row?.[a]
  }
  const finish = (row: unknown[]): D3PPoint => row.map((v, k) => (k > 0 && nullish(v) ? NaN : v)) as D3PPoint

  if (nullish(data) || typeof data !== 'object') return []

  // column-oriented: an object whose values are the columns
  if (!Array.isArray(data) && !ArrayBuffer.isView(data) && !(Symbol.iterator in data)) {
    const source = data as Record<string, ArrayLike<unknown>>
    const column = (col: string) => {
      const a = accessor(col)
      return typeof a === 'function' ? undefined : source[a]
    }
    const columns = stored.map(column)
    if (columns.some((c) => !c)) return []
    const n = Math.max(...columns.map((c) => c!.length))
    const out: D3PPoint[] = []
    for (let i = 0; i < n; i++) {
      const row = columns.map((c) => c![i])
      if (!nullish(row[0]) && !nullish(row[1])) out.push(finish(row))
    }
    return out
  }

  const rows = Array.isArray(data) ? data : Array.from(data as Iterable<unknown>)
  if (!rows.length) return []
  const first = rows[0]

  if (!fields && typeof first === 'number') {
    if (input.length !== 2) throw new Error(`[d3pict] data given as plain numbers needs two columns, the series has ${input.join(', ')}`)
    return rows.map((y, i) => [i, y as number])
  }
  if (!fields && Array.isArray(first)) {
    const at = stored.map((c) => input.indexOf(c))
    return rows.map((r) => finish(at.map((k) => (r as unknown[])[k])))
  }
  if (first && typeof first === 'object') {
    const out: D3PPoint[] = []
    rows.forEach((r, i) => {
      const row = stored.map((c) => read(r, i, c))
      if (!nullish(row[0]) && !nullish(row[1])) out.push(finish(row))
    })
    return out
  }
  return []
}

/**
 * Options of a series: its name, its data, its columns, and the columns the domains, the tooltip and the display use.
 */
export interface D3PSeriesOptions extends D3PColumnSpec {
  /** The bus the series uses (the global bus by default). */
  bus?: D3PBus
  /** The name of the series, shown in tooltips and legends. */
  name: string
  /** The first rows. Anything `D3PSeriesData` accepts. */
  data?: D3PSeriesData
  /**
   * Value columns that the auto domain fits when the series is linked to two domains (default:
   * all of them, but `size`, `value`, `kind`, `color` and `label`, which are not positions). A
   * stack leaves its original values out, for instance.
   */
  domainColumns?: readonly string[]
  /** Column the tooltip shows as the value (default: the primary one). */
  display?: string
  /** Columns the tooltip lists when the series has several (default: all but `x`). */
  tooltipColumns?: readonly string[]
  /** Formats the `display` column when it is not the primary one (the axis format fits positions, not always the original values). */
  displayFormat?: (value: number) => string
  /**
   * Columns the auto domain fits the X domain to (default: `x`). A histogram lists the edges of
   * its bins, so the axis covers the whole of the first and last bar.
   */
  xColumns?: readonly string[]
}

/**
 * A series: a list of rows, `[x, value, ...other columns]`, that renderers draw. Assign `series.data` to change it: everything that draws the series follows, with an animation.
 */
export class D3PSeries extends D3PObject<{ dataChanged: D3PSeries }> {
  /** The name of the series: shown by tooltips and legends, and the default name of its renderers. */
  readonly name: string
  /** Column names, in the order of the points: `x`, the primary column, then the others. */
  readonly columns: readonly string[]
  /** Column names in the order of the input (x first), for display. */
  readonly inputColumns: readonly string[]
  /** The value columns that the auto domain fits. */
  readonly domainColumns: readonly string[]
  /** The columns the auto domain fits to the X domain. */
  readonly xColumns: readonly string[]
  /** The columns the tooltip lists. */
  readonly tooltipColumns: readonly string[]
  /** Formats the `display` column. */
  readonly displayFormat: ((value: number) => string) | undefined
  /** The column the tooltip shows as the value. */
  readonly display: string
  private points: D3PPoint[]
  private readonly spec: D3PColumnSpec

  constructor(opts: D3PSeriesOptions) {
    super(`series[${opts.name}]`, ['dataChanged'], opts.bus)
    this.name = opts.name
    this.spec = { columns: opts.columns, primary: opts.primary, fields: opts.fields }
    const layout = d3pColumnLayout(this.spec)
    this.columns = layout.stored
    this.inputColumns = layout.input
    this.domainColumns = opts.domainColumns ?? this.columns.slice(1).filter((c) => !NON_SPATIAL.has(c))
    this.xColumns = opts.xColumns ?? [this.columns[0]]
    this.tooltipColumns = opts.tooltipColumns ?? this.columns.slice(1)
    this.displayFormat = opts.displayFormat
    this.display = opts.display ?? this.columns[1]
    for (const c of [...this.domainColumns, ...this.xColumns, ...this.tooltipColumns, this.display]) if (!this.columns.includes(c)) throw new Error(`[d3pict] series "${opts.name}" has no column "${c}" (columns: ${this.columns.join(', ')})`)
    this.points = d3pNormalizeSeries(opts.data, this.spec)
  }

  /** The rows, as `[x, value, ...other columns]`. */
  get data(): D3PPoint[] {
    return this.points
  }

  /**
   * Replaces the rows. Anything `D3PSeriesData` accepts. Everything that draws the series follows, with an animation.
   */
  set data(value: D3PSeriesData) {
    this.points = d3pNormalizeSeries(value, this.spec)
    this.fire(this.e.dataChanged, this)
  }

  /** Index of a column in the points, or -1. */
  index(column: string): number {
    return this.columns.indexOf(column)
  }

  /** Whether the series has a column of that name. */
  has(column: string): boolean {
    return this.columns.includes(column)
  }

  /** The values of one column. */
  column(name: string): any[] {
    const i = this.index(name)
    if (i < 0) throw new Error(`[d3pict] series "${this.name}" has no column "${name}" (columns: ${this.columns.join(', ')})`)
    return this.points.map((p) => p[i])
  }
}

// ---------------------------------------------------------------------------
// Auto domain
// ---------------------------------------------------------------------------

const isValid = (v: unknown) => v !== undefined && v !== null && !(typeof v === 'number' && Number.isNaN(v)) && !(v instanceof Date && Number.isNaN(v.valueOf()))

/** `[min, max]` for numbers/dates, ordered distinct categories for strings; `undefined` if empty. */
function extent(values: Iterable<D3PDomainValue>): D3PDomainValue[] | undefined {
  let min: D3PDomainValue | undefined
  let max: D3PDomainValue | undefined
  const cats: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    if (!isValid(v)) continue
    if (typeof v === 'string') {
      if (!seen.has(v)) seen.add(v), cats.push(v)
      continue
    }
    if (min === undefined || v < min) min = v
    if (max === undefined || v > max) max = v
  }
  if (cats.length) return cats
  return min === undefined || max === undefined ? undefined : [min, max]
}

/**
 * Options of an auto domain: the bus, and whether it is active (it fits the domains while it is).
 */
export interface D3PAutoDomainOptions {
  /** The bus the auto domain uses (the global bus by default). */
  bus?: D3PBus
  /** Whether it fits the domains (default true). Setting it to `true` fits them at once. */
  active?: boolean
}

/**
 * Fits axis domains to the extent of the series feeding them. `mapping[i]` is the domain
 * that receives column `i` of the series (0 = x, 1 = the primary value; null/undefined = ignored);
 * columns past the end of a two-entry mapping feed the second domain, so a candlestick series
 * linked to `[time, price]` fits `price` to its lows and highs. A record maps columns by name:
 * `{ x: time, high: price, low: price }`.
 */
export class D3PAutoDomain extends D3PObject {
  private links = new Map<D3PSeries, { mapping: (D3PAxisDomain | null | undefined)[]; extents: (D3PDomainValue[] | undefined)[]; off: () => void; offDestroy: () => void }>()
  private candidates = new Map<D3PAxisDomain, D3PDomainValue[]>()
  private domainOffs = new Map<D3PAxisDomain, () => void>()
  private _active: boolean

  constructor(opts: D3PAutoDomainOptions = {}) {
    super('autoDomain', [], opts.bus)
    this._active = opts.active ?? true
  }

  /** Whether it fits the domains. */
  get active(): boolean {
    return this._active
  }
  /** Turns the fitting on or off. */
  set active(v: boolean) {
    this._active = v
    if (v) this.apply()
  }

  /**
   * Fits domains to this series. `spec` lists the domain of each column (`[time, price]`), or maps column names to domains. It replaces any link the series already had.
   */
  linkSeries(series: D3PSeries, spec: (D3PAxisDomain | null | undefined)[] | Record<string, D3PAxisDomain | null | undefined>): void {
    const mapping = Array.isArray(spec) ? this.expand(series, spec) : this.byName(series, spec) // may throw: validate before replacing the previous link
    this.unlinkSeries(series)
    const link = {
      mapping,
      extents: [] as (D3PDomainValue[] | undefined)[],
      off: this.bus.on(series.e.dataChanged, () => this.update(series)),
      offDestroy: this.bus.on(series.e.destroyed, () => this.unlinkSeries(series)),
    }
    this.links.set(series, link)
    for (const d of mapping) {
      if (d && !this.domainOffs.has(d)) this.domainOffs.set(d, this.bus.on(d.e.destroyed, () => this.unlinkAxisDomain(d)))
    }
    this.update(series)
  }

  /**
   * `[x, y]` (or one domain per column): with two domains, every domain column of the series
   * feeds the second one, whatever its position among the columns.
   */
  private expand(series: D3PSeries, given: (D3PAxisDomain | null | undefined)[]): (D3PAxisDomain | null | undefined)[] {
    return series.columns.map((c, i) => {
      if (i === 0) return given[0]
      if (given.length > 2) return given[i]
      return series.domainColumns.includes(c) ? given[1] : null
    })
  }

  private byName(series: D3PSeries, given: Record<string, D3PAxisDomain | null | undefined>): (D3PAxisDomain | null | undefined)[] {
    for (const name of Object.keys(given)) if (!series.has(name)) throw new Error(`[d3pict] series "${series.name}" has no column "${name}" (columns: ${series.columns.join(', ')})`)
    return series.columns.map((c) => given[c])
  }

  /** Stops fitting domains to this series. */
  unlinkSeries(series: D3PSeries): void {
    const link = this.links.get(series)
    if (!link) return
    link.off()
    link.offDestroy()
    this.links.delete(series)
    this.recompute(link.mapping.filter((d): d is D3PAxisDomain => !!d))
    this.releaseUnusedDomains()
  }

  /** Stops fitting a domain, whatever series feed it. */
  unlinkAxisDomain(domain: D3PAxisDomain): void {
    for (const link of this.links.values()) link.mapping = link.mapping.map((d) => (d === domain ? null : d))
    this.candidates.delete(domain)
    this.domainOffs.get(domain)?.()
    this.domainOffs.delete(domain)
  }

  /** Apply the candidates now (all domains, or the given ones). */
  apply(domains?: D3PAxisDomain[]): void {
    for (const [d, c] of this.candidates) {
      if (domains && !domains.includes(d)) continue
      if (c.length) d.domain = c
    }
  }

  private update(series: D3PSeries) {
    const link = this.links.get(series)
    if (!link) return
    link.extents = link.mapping.map((d, i) => {
      if (!d) return undefined
      const at = i === 0 ? series.xColumns.map((c) => series.index(c)) : [i]
      return extent(series.data.flatMap((p) => at.flatMap((k) => (Array.isArray(p[k]) ? p[k] : [p[k]]))) as D3PDomainValue[])
    })
    const affected = link.mapping.filter((d): d is D3PAxisDomain => !!d)
    this.recompute(affected)
    if (this._active) this.apply(affected)
  }

  private recompute(domains: D3PAxisDomain[]) {
    for (const d of new Set(domains)) {
      const parts: D3PDomainValue[][] = []
      for (const link of this.links.values()) link.mapping.forEach((m, i) => m === d && link.extents[i] && parts.push(link.extents[i]!))
      if (!parts.length) {
        this.candidates.delete(d)
        continue
      }
      const cats = parts.flat().filter((v) => typeof v === 'string') as string[]
      this.candidates.set(d, cats.length ? [...new Set(cats)] : extent(parts.flat())!)
    }
  }

  private releaseUnusedDomains() {
    const used = new Set<D3PAxisDomain>()
    for (const l of this.links.values()) l.mapping.forEach((d) => d && used.add(d))
    for (const [d, off] of this.domainOffs) if (!used.has(d)) off(), this.domainOffs.delete(d)
  }

  protected override onDestroy(): void {
    for (const s of [...this.links.keys()]) this.unlinkSeries(s)
    for (const off of this.domainOffs.values()) off()
    this.domainOffs.clear()
  }
}

// ---------------------------------------------------------------------------
// Series interpolator (transitions)
// ---------------------------------------------------------------------------

/** A point in range units (or pixels): `[a, b]`, plus optional extra components (the base of an area). */
export type D3PPixelPoint = [number, number, ...number[]]

/**
 * What a renderer remembers of a drawing: the position of each point in range units, and, for
 * each, its `key`, the value on the x axis (a number, or the time of a date). Points of two
 * drawings are paired by key; they are animated by position.
 */
export interface D3PPlacedSeries {
  /** The x value of each point. */
  keys: number[]
  /** The positions of the points, in range units. */
  points: D3PPixelPoint[]
}

/** The key of a point: its x value if it is a number or a date, else (categories) its position. */
export function d3pPointKey(x: unknown, position: number): number {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (x instanceof Date && Number.isFinite(x.getTime())) return x.getTime()
  return position
}

/**
 * The result of `d3pInterpolateSeries`: a function of `t` (0 to 1) that gives the points of a frame, with the keys of those points and the two lists it interpolates between.
 */
export interface D3PSeriesInterpolator {
  (t: number): D3PPixelPoint[]
  /** The key of each point of the frames, in the same order. */
  keys: number[]
  /** What it moves from: a drawing, or the number of the baseline to grow from. */
  from: D3PPlacedSeries | number
  /** What it moves to. */
  to: D3PPlacedSeries
  /** The points it moves from, as long as `interpolatedTo`. */
  interpolatedFrom: D3PPixelPoint[]
  /** The points it moves to, as long as `interpolatedFrom`. */
  interpolatedTo: D3PPixelPoint[]
}

const sortedKeys = (keys: number[]) => keys.every((k, i) => i === 0 || keys[i - 1] <= k)

/**
 * Interpolator between two drawings of a series. Both are first made as long as each other by a
 * merge on the keys (the x values): points with the same key are paired, and a point without a
 * partner is paired with the nearest point of the other drawing, so it is born (or dies) on its
 * neighbor. The positions are then interpolated. `from` may be a number (the baseline) to grow
 * from. Keys that are not sorted fall back to pairing by index.
 */
export function d3pInterpolateSeries(from: D3PPlacedSeries | number, to: D3PPlacedSeries): D3PSeriesInterpolator {
  const copy = (p: D3PPixelPoint) => [...p] as D3PPixelPoint
  let a: D3PPixelPoint[] = []
  let b: D3PPixelPoint[] = []
  let keys: number[] = []
  if (typeof from === 'number') {
    a = to.points.map((p) => [p[0], from, ...p.slice(2).map(() => from)] as D3PPixelPoint)
    b = to.points.map(copy)
    keys = [...to.keys]
  } else if (!from.points.length || !to.points.length) {
    // nothing to pair with: collapse on the other side's own points
    const only = from.points.length ? from : to
    a = only.points.map(copy)
    b = only.points.map(copy)
    keys = [...only.keys]
    if (!from.points.length) a = to.points.map(copy)
    if (!to.points.length) b = from.points.map(copy)
  } else if (!sortedKeys(from.keys) || !sortedKeys(to.keys)) {
    const n = Math.max(from.points.length, to.points.length)
    for (let k = 0; k < n; k++) {
      const f = Math.min(k, from.points.length - 1)
      const t = Math.min(k, to.points.length - 1)
      a.push(copy(from.points[f]))
      b.push(copy(to.points[t]))
      keys.push(to.keys[t])
    }
  } else {
    let i = 0
    let j = 0
    let lastF: number | undefined
    let lastT: number | undefined
    const nearest = (key: number, last: number | undefined, next: number | undefined, points: D3PPixelPoint[], keysOf: number[]) => {
      if (last === undefined) return points[next!]
      if (next === undefined) return points[last]
      return key - keysOf[last] <= keysOf[next] - key ? points[last] : points[next]
    }
    while (i < from.points.length || j < to.points.length) {
      const fk = i < from.points.length ? from.keys[i] : Infinity
      const tk = j < to.points.length ? to.keys[j] : Infinity
      if (fk === tk) {
        a.push(copy(from.points[i])), b.push(copy(to.points[j])), keys.push(tk)
        lastF = i, lastT = j
        i++, j++
      } else if (fk < tk) {
        a.push(copy(from.points[i])), b.push(copy(nearest(fk, lastT, j < to.points.length ? j : undefined, to.points, to.keys))), keys.push(fk)
        lastF = i
        i++
      } else {
        b.push(copy(to.points[j])), a.push(copy(nearest(tk, lastF, i < from.points.length ? i : undefined, from.points, from.keys))), keys.push(tk)
        lastT = j
        j++
      }
    }
  }
  const fn = ((t: number) =>
    a.map((p, k) =>
      Array.from({ length: Math.max(p.length, b[k].length) }, (_, c) => {
        const v = p[c] ?? b[k][c] // a component missing on one side (the base of an area) starts at the other's value
        return v + ((b[k][c] ?? v) - v) * t
      }) as D3PPixelPoint,
    )) as D3PSeriesInterpolator
  fn.keys = keys
  fn.from = from
  fn.to = to
  fn.interpolatedFrom = a
  fn.interpolatedTo = b
  return fn
}
