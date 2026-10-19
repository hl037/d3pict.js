import type { D3PBus } from './bus'
import { D3PAxis } from './axis'
import { D3PChart } from './chart'
import { D3PAxisDomain } from './domain'
import { D3PAreaRenderer } from './renderers/area'
import { D3PBarRenderer } from './renderers/bar'
import { D3PLineRenderer } from './renderers/line'
import { D3PAutoDomain, D3PSeries, type D3PSeriesData } from './series'
import type { D3PCurve } from './util'

/**
 * Options of a sparkline: the container, the data, the type of chart, its color, size, value range, curve, stroke width and padding.
 */
export interface D3PSparklineOptions {
  /** The element it is drawn in. */
  container: Element | string
  /** The values: anything `D3PSeriesData` accepts. */
  data: D3PSeriesData
  /** What is drawn: a line (the default), an area or bars. */
  type?: 'line' | 'area' | 'bar'
  /** Color of the drawing. */
  color?: string
  /** Fixed size; default: the container's. */
  width?: number
  /** Height in pixels; the container's by default. */
  height?: number
  /** Fix the ends of the value axis (default: fitted to the data). */
  min?: number
  /** Upper end of the value axis; fitted to the data by default. */
  max?: number
  /** How the points of a line or an area are joined. */
  curve?: D3PCurve
  /** Width of the line, in pixels. */
  strokeWidth?: number
  /** Space around the drawing, in pixels (default 2). */
  padding?: number
  /** The bus the sparkline uses (the global bus by default). */
  bus?: D3PBus
}

/**
 * A small chart made by `d3pSparkline`: its chart and its series, a function to replace the data, and `destroy`.
 */
export interface D3PSparkline {
  /** The chart it is drawn on. */
  chart: D3PChart
  /** The series it shows. */
  series: D3PSeries
  /** Replace the data; the axes follow. */
  update(data: D3PSeriesData): void
  /** Removes the sparkline. */
  destroy(): void
}

/**
 * A sparkline: a chart without axes, margins or interaction, meant to sit inside text or a table
 * cell. It is an ordinary chart with its axes hidden, so everything else (tooltip, annotations...)
 * still attaches to `sparkline.chart`.
 */
export function d3pSparkline(opts: D3PSparklineOptions): D3PSparkline {
  const pad = opts.padding ?? 2
  const chart = new D3PChart({ container: opts.container, bus: opts.bus, width: opts.width, height: opts.height, margin: { top: pad, right: pad, bottom: pad, left: pad } })
  const bus = chart.bus
  const bar = opts.type === 'bar'
  const series = new D3PSeries({ bus, name: 'sparkline' })
  const x = new D3PAxisDomain({ bus, domain: [0, 1] })
  const y = new D3PAxisDomain({ bus, domain: [0, 1] })
  const axes = [
    new D3PAxis({ bus, name: 'x', domain: x, scaleType: bar ? 'band' : 'linear' }),
    new D3PAxis({ bus, name: 'y', domain: y, position: 'left' }),
  ]
  const auto = new D3PAutoDomain({ bus })
  const fixedEnds = opts.min !== undefined || opts.max !== undefined
  auto.linkSeries(series, [x, fixedEnds ? null : y]) // with fixed ends the value domain is set by hand
  const style = { color: opts.color ?? '#4e79a7' }
  const renderer =
    opts.type === 'area'
      ? new D3PAreaRenderer({ bus, series, props: { style: { ...style, curve: opts.curve ?? 'linear' } } })
      : bar
        ? new D3PBarRenderer({ bus, series, props: { style: { ...style, negativeColor: '#e15759' } } })
        : new D3PLineRenderer({ bus, series, props: { style: { ...style, strokeWidth: opts.strokeWidth ?? 1.5, curve: opts.curve ?? 'linear' } } })
  const set = (data: D3PSeriesData) => {
    // bars sit on categories: number the points
    series.data = bar ? normalizeForBars(data) : data
    if (fixedEnds) {
      const values = series.data.map((p) => p[1]).filter(Number.isFinite)
      y.domain = [opts.min ?? Math.min(...values), opts.max ?? Math.max(...values)]
    }
  }
  axes.forEach((a) => a.addToChart(chart))
  renderer.addToChart(chart)
  axes.forEach((a) => a.setVisible(false))
  set(opts.data)
  return {
    chart,
    series,
    update: (data) => set(data),
    destroy: () => {
      chart.destroy()
      for (const o of [renderer, series, auto, x, y, ...axes]) o.destroy()
    },
  }
}

function normalizeForBars(data: D3PSeriesData): [string, number][] {
  const values = Array.isArray(data) || ArrayBuffer.isView(data) ? Array.from(data as ArrayLike<unknown>) : []
  return values.map((v, i) => [String(i), typeof v === 'number' ? v : Array.isArray(v) ? (v[1] as number) : ((v as { y?: number }).y as number)])
}
