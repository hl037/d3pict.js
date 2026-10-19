import * as d3 from 'd3'
import type { D3PBus, D3PUnsubscribe } from './bus'
import { D3PObject } from './object'
import { D3PSeries, type D3PPoint } from './series'
import { d3pToNumber } from './util'

/**
 * Transforms: objects that derive new series from existing ones and keep them up to date.
 * The derived series are ordinary series (renderers, legends and auto domains use them as
 * they are); what they add is extra columns (`y0`, `x0`, `x1`...) that renderers read.
 */

abstract class D3PTransform extends D3PObject<{ changed: void }> {
  private offs: D3PUnsubscribe[] = []

  constructor(label: string, /** The series it reads. */ protected readonly inputs: D3PSeries[], bus?: D3PBus) {
    super(label, ['changed'], bus ?? inputs[0]?.bus)
  }

  /** Recompute whenever an input changes, and when it is destroyed. */
  protected watch() {
    for (const s of this.inputs) {
      this.offs.push(this.bus.on(s.e.dataChanged, () => this.refresh()))
      this.offs.push(this.bus.on(s.e.destroyed, () => this.refresh()))
    }
  }

  /** Computes the derived series from the inputs. */
  protected abstract compute(): void

  /** Computes again, and announces `changed`. */
  protected refresh() {
    if (this.isDestroying) return
    this.compute()
    this.fire(this.e.changed)
  }

  /** Stops listening to the inputs. */
  protected override onDestroy(): void {
    for (const off of this.offs) off()
    this.offs = []
  }
}

/** The original values of a stack are plain numbers, whatever the format of the axis (percent, for a 100 % stack). */
const plainNumber = d3.format(',.4~g')

const key = (x: unknown) => (x instanceof Date ? +x : x)

/** The x values of several series, merged: sorted when numeric or dates, in order of appearance otherwise. */
function unionOfX(inputs: D3PSeries[]): D3PPoint[0][] {
  const seen = new Map<unknown, D3PPoint[0]>()
  for (const s of inputs) for (const p of s.data) if (!seen.has(key(p[0]))) seen.set(key(p[0]), p[0])
  const xs = [...seen.values()]
  return xs.every((x) => d3pToNumber(x) !== undefined) ? xs.sort((a, b) => d3pToNumber(a)! - d3pToNumber(b)!) : xs
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

/**
 * How stacked layers are placed: on top of each other (`none`), as shares (`expand`), around zero (`diverging`, `silhouette`) or following the changes (`wiggle`).
 */
export type D3PStackOffset = 'none' | 'expand' | 'diverging' | 'silhouette' | 'wiggle'
/** The order of the layers of a stack. */
export type D3PStackOrder = 'none' | 'ascending' | 'descending' | 'insideOut' | 'reverse'

/** Options of a stack: the series to stack, the offset and the order of the layers. */
export interface D3PStackOptions {
  /** The bus the stack uses (the global bus by default). */
  bus?: D3PBus
  /** Series to stack, bottom first (see `order`). They should share their x values; a missing x counts as 0. */
  series: D3PSeries[]
  /**
   * `none`: layers add up from zero. `expand`: normalized to 0-1 (100 % stacks). `diverging`:
   * negatives go below zero. `silhouette` and `wiggle`: centered around the axis (streamgraphs;
   * pair `wiggle` with `order: 'insideOut'`).
   */
  offset?: D3PStackOffset
  /** The order of the layers (the order of the inputs by default). */
  order?: D3PStackOrder
}

const OFFSETS = { none: d3.stackOffsetNone, expand: d3.stackOffsetExpand, diverging: d3.stackOffsetDiverging, silhouette: d3.stackOffsetSilhouette, wiggle: d3.stackOffsetWiggle }
const ORDERS = { none: d3.stackOrderNone, ascending: d3.stackOrderAscending, descending: d3.stackOrderDescending, insideOut: d3.stackOrderInsideOut, reverse: d3.stackOrderReverse }

/**
 * Stacks series on top of each other. `stack.series[i]` is the layer of input `i`, with the
 * columns `x`, `y` (top of the layer), `y0` (its base) and `value` (the original value, which the
 * tooltip shows). Areas and bars draw between `y0` and `y` by themselves; lines draw the top.
 * Link the layers to an auto domain: its domain then covers `y0` and `y`, not the raw values.
 */
export class D3PStack extends D3PTransform {
  /** The layers, one for each input: draw them and link them to an auto domain. */
  readonly series: D3PSeries[]
  /**
   * How the layers are placed: on top of each other, as shares, around zero... Change it with `setLayout`, which stacks again.
   */
  offset: D3PStackOffset
  /** The order of the layers. Change it with `setLayout`, which stacks again. */
  order: D3PStackOrder

  constructor(opts: D3PStackOptions) {
    super('stack', opts.series, opts.bus)
    this.offset = opts.offset ?? 'none'
    this.order = opts.order ?? 'none'
    this.series = opts.series.map((s) => new D3PSeries({ bus: this.bus, name: s.name, columns: ['x', 'y', 'y0', 'value'], display: 'value', domainColumns: ['y', 'y0'], displayFormat: plainNumber }))
    this.watch()
    this.compute()
  }

  /** Change the layout and recompute. */
  setLayout(layout: { offset?: D3PStackOffset; order?: D3PStackOrder }): void {
    if (layout.offset) this.offset = layout.offset
    if (layout.order) this.order = layout.order
    this.refresh()
  }

  /** Stacks the inputs: `y0` and `y` of each layer follow the offset and the order. */
  protected compute(): void {
    const xs = unionOfX(this.inputs)
    const lookup = this.inputs.map((s) => new Map(s.data.map((p) => [key(p[0]), p[1]])))
    const rows = xs.map((x) => lookup.map((m) => m.get(key(x)) ?? 0))
    const layers = d3
      .stack<number[], number>()
      .keys(this.inputs.map((_, i) => i) as never)
      .value((row, i) => (Number.isFinite(row[i as number]) ? row[i as number] : 0))
      .order(ORDERS[this.order])
      .offset(OFFSETS[this.offset])(rows)
    layers.forEach((layer, i) => {
      this.series[i].data = layer.map((cell, j) => [xs[j], cell[1], cell[0], rows[j][i]])
    })
  }

  /** Stops listening to the inputs and destroys the layers. */
  protected override onDestroy(): void {
    super.onDestroy()
    for (const s of this.series) s.destroy()
  }
}

// ---------------------------------------------------------------------------
// Waterfall
// ---------------------------------------------------------------------------

/** Options of a waterfall: the series, and which rows are totals. */
export interface D3PWaterfallOptions {
  /** The bus the waterfall uses (the global bus by default). */
  bus?: D3PBus
  /** The steps: `x` is the label, the value the change. */
  series: D3PSeries
  /**
   * Which points are totals: they are drawn from zero to the running sum (their own value is
   * ignored). Indexes, labels, or a function.
   */
  totals?: ReadonlyArray<number | string> | ((x: D3PPoint[0], index: number) => boolean)
}

/**
 * A waterfall of running sums. `waterfall.series` has the columns `x`, `y` (end of the step),
 * `y0` (its start), `value` (the change, or the running sum for a total) and `kind` (`up`, `down`
 * or `total`, to color bars with `style.colorBy`).
 */
export class D3PWaterfall extends D3PTransform {
  /** The series the waterfall makes. */
  readonly series: D3PSeries
  private readonly isTotal: (x: D3PPoint[0], index: number) => boolean

  constructor(opts: D3PWaterfallOptions) {
    super('waterfall', [opts.series], opts.bus)
    const t = opts.totals ?? []
    this.isTotal = typeof t === 'function' ? t : (x, i) => t.includes(i) || t.includes(x as string)
    this.series = new D3PSeries({ bus: this.bus, name: opts.series.name, columns: ['x', 'y', 'y0', 'value', 'kind'], primary: 'y', display: 'value', domainColumns: ['y', 'y0'], displayFormat: plainNumber })
    this.watch()
    this.compute()
  }

  /** Computes the running sums, with a total where the rows say so. */
  protected compute(): void {
    let sum = 0
    this.series.data = this.inputs[0].data.map((p, i) => {
      if (this.isTotal(p[0], i)) return [p[0], sum, 0, sum, 'total']
      const start = sum
      sum += Number.isFinite(p[1]) ? p[1] : 0
      return [p[0], sum, start, p[1], p[1] < 0 ? 'down' : 'up']
    })
  }

  /** Stops listening to the input and destroys the series it made. */
  protected override onDestroy(): void {
    super.onDestroy()
    this.series.destroy()
  }
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

/** A bin of a histogram: its bounds, its middle and the number of values in it. */
export interface D3PHistogramBin {
  /** Middle of the bin. */
  x: number
  /** The number of values in the bin. */
  count: number
  /** Lower edge of the bin. */
  x0: number
  /** Upper edge of the bin. */
  x1: number
}

/**
 * Bin numbers (`d3.bin`). `thresholds` is a number of bins, or the **edges** of the bins (the
 * first and last included, so `[0, 4, 8, 12]` makes three bins); `domain` limits the range.
 */
export function d3pHistogram(values: Iterable<number>, opts: { thresholds?: number | number[]; domain?: [number, number] } = {}): D3PHistogramBin[] {
  const bin = d3.bin<number, number>().value((v) => v)
  const t = opts.thresholds
  if (Array.isArray(t) && t.length >= 2) {
    bin.domain([t[0], t[t.length - 1]]).thresholds(t.slice(1, -1))
  } else {
    if (opts.domain) bin.domain(opts.domain)
    if (typeof t === 'number') bin.thresholds(t)
  }
  return bin([...values].filter((v) => Number.isFinite(v))).map((b) => ({ x: ((b.x0 ?? 0) + (b.x1 ?? 0)) / 2, count: b.length, x0: b.x0 ?? 0, x1: b.x1 ?? 0 }))
}

/**
 * Options of a histogram: the series, the thresholds of the bins, the domain they cover and the name of the series made.
 */
export interface D3PHistogramOptions {
  /** The bus the histogram uses (the global bus by default). */
  bus?: D3PBus
  /** Series whose values (the primary column) are binned. */
  series: D3PSeries
  /** A number of bins, or the edges of the bins (see `d3pHistogram`). */
  thresholds?: number | number[]
  /** The `[min, max]` the bins cover (the extent of the data by default). */
  domain?: [number, number]
  /** Name of the derived series (default: the input's). */
  name?: string
}

/**
 * Bins the values of a series. `histogram.series` has the columns `x` (middle of the bin), `y`
 * (the count), `x0` and `x1` (the edges): bars use the edges as their width, and an auto domain
 * fits the X axis to them.
 */
export class D3PHistogram extends D3PTransform {
  /** The series the histogram makes. */
  readonly series: D3PSeries

  constructor(private readonly opts: D3PHistogramOptions) {
    super('histogram', [opts.series], opts.bus)
    this.series = new D3PSeries({ bus: this.bus, name: opts.name ?? opts.series.name, columns: ['x', 'y', 'x0', 'x1'], domainColumns: ['y'], xColumns: ['x0', 'x1'], tooltipColumns: ['y'] })
    this.watch()
    this.compute()
  }

  /** Counts the values of the input in each bin. */
  protected compute(): void {
    const bins = d3pHistogram(this.opts.series.data.map((p) => p[1]), { thresholds: this.opts.thresholds, domain: this.opts.domain })
    this.series.data = bins.map((b) => [b.x, b.count, b.x0, b.x1])
  }

  /** Stops listening to the input and destroys the series it made. */
  protected override onDestroy(): void {
    super.onDestroy()
    this.series.destroy()
  }
}
