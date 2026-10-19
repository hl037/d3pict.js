/**
 * The scenes of the chart types gallery. Each one is written the way an application would write
 * it: create domains and series, axes, one or several renderers, then the cursor, tooltip and
 * legend, and hand the lot to a chart. Only `scene()` at the end of each is specific to the
 * gallery: it says what to attach to the chart and what to destroy when the scene is replaced.
 */
import * as d3 from 'd3'
import {
  D3PAnnotationBand, D3PAnnotationLine, D3PAnnotationPoint, D3PAnnotationText, D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain,
  D3PBarRenderer, D3PBoxPlotRenderer, D3PBubbleRenderer, D3PCandlestickRenderer, D3PColorLegend, D3PColorScale, D3PCursorIndicator,
  D3PDumbbellRenderer, D3PFunnelRenderer, D3PHeatmapRenderer, D3PHistogram, D3PLegendBundle, D3PLineRenderer, D3PPieRenderer, D3PPolarSystem,
  D3PRadarAngleAxisRenderer, D3PRadiusAxis, D3PScatterRenderer, D3PSeries, D3PStack, D3PTooltip, D3PWaterfall, D3P_BOXPLOT_COLUMNS, d3pBoxPlotRows,
  type D3PBus, type D3PMargin,
} from '../../src'
import { rng, walk } from '../shared/data'
import { destroyAll } from './destroy'

type Attachable = { addToChart(chart: any): void; removeFromChart(chart: any): void; destroy(): void }

/** What the frameworks need to show a scene: the objects to attach, and the HTML parts. */
export interface GalleryScene {
  objects: Attachable[]
  tooltip?: D3PTooltip
  legend?: D3PLegendBundle
  margin?: Partial<D3PMargin>
  destroy(): void
}

export interface GalleryEntry {
  id: string
  group: 'cartesian' | 'polar' | 'noaxes'
  build(bus: D3PBus): GalleryScene
}

/**
 * The gallery's only helper. `objects` go on the chart; `others` (domains, series, transforms)
 * are not attachable but must be destroyed with the scene, so that they leave the bus.
 */
function scene(parts: { objects: Attachable[]; others?: { destroy(): void }[]; tooltip?: D3PTooltip; legend?: D3PLegendBundle; margin?: Partial<D3PMargin> }): GalleryScene {
  const { objects, others = [], ...rest } = parts
  return { objects, ...rest, destroy: () => destroyAll([...objects, ...others]) }
}

// #region helpers
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const COLORS = d3.schemeTableau10
const month = (v: unknown) => MONTHS[Math.round(Number(v))] ?? ''
/** A series of numbers over 12 months, x being the month index. */
const monthly = (seed: number, base: number, spread: number) => walk(seed, 12, base, spread, 5, 100).map((v, i) => [i, v] as [number, number])
// #endregion helpers

// ---------------------------------------------------------------------------
// Cartesian
// ---------------------------------------------------------------------------

const curves: GalleryEntry = {
  id: 'curves',
  group: 'cartesian',
  build(bus) {
    // #region curves
    const raw = walk(5, 30, 50, 25, 10, 90)
    const dx = new D3PAxisDomain({ bus, domain: [0, 29] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
    const x = new D3PAxis({ bus, name: 'x', domain: dx })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })

    // one series with a hole in it, joined three ways
    const withGap = new D3PSeries({ bus, name: 'linear', data: raw.map((v, i) => (i === 12 || i === 13 ? NaN : v)) })
    const above = new D3PSeries({ bus, name: 'monotone', data: raw.map((v) => Math.min(100, v + 15)) })
    const below = new D3PSeries({ bus, name: 'step', data: raw.map((v) => Math.max(0, v - 25)) })
    const linear = new D3PLineRenderer({ bus, series: withGap, props: { style: { color: COLORS[0], curve: 'linear', gaps: 'break' } } })
    const monotone = new D3PLineRenderer({ bus, series: above, props: { style: { color: COLORS[1], curve: 'monotone' } } })
    const step = new D3PLineRenderer({ bus, series: below, props: { style: { color: COLORS[2], curve: 'step' } } })

    const cursor = new D3PCursorIndicator({ bus })
    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [x, y, linear, monotone, step, cursor, tooltip, legend]
    // #endregion curves
    return scene({ objects, others: [dx, dy, withGap, above, below], tooltip, legend })
  },
}

/** Four stacked series as areas: plain, 100 %, or centered (a streamgraph). */
function stackedArea(id: string, opts: { offset?: 'none' | 'expand' | 'silhouette' | 'wiggle'; order?: 'none' | 'insideOut' }): GalleryEntry {
  return {
    id,
    group: 'cartesian',
    build(bus) {
      const { offset, order } = opts
      // #region stackedArea
      const names = ['Search', 'Social', 'Direct', 'Email']
      const inputs = names.map((name, i) => new D3PSeries({ bus, name, data: monthly(i + 1, 25, 18) }))
      // the stack derives one series per input, with the base (y0) of each layer
      const stack = new D3PStack({ bus, series: inputs, offset, order })

      const dx = new D3PAxisDomain({ bus, domain: [0, 11] })
      const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
      const auto = new D3PAutoDomain({ bus })
      for (const layer of stack.series) auto.linkSeries(layer, [dx, dy])

      const x = new D3PAxis({ bus, name: 'x', domain: dx, props: { tickFormat: month } })
      const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true }, tickFormat: offset === 'expand' ? d3.format('.0%') : null } })
      const layers = stack.series.map((layer, i) => new D3PAreaRenderer({ bus, series: layer, props: { style: { color: COLORS[i], opacity: 0.85, curve: 'monotone' } } }))

      const cursor = new D3PCursorIndicator({ bus })
      const tooltip = new D3PTooltip({ bus })
      const legend = new D3PLegendBundle({ bus })
      const objects = [x, y, ...layers, cursor, tooltip, legend]
      // #endregion stackedArea
      return scene({ objects, others: [...inputs, stack, dx, dy, auto], tooltip, legend })
    },
  }
}

const stackedColumn: GalleryEntry = {
  id: 'stacked-column',
  group: 'cartesian',
  build(bus) {
    // #region stackedColumn
    const names = ['Search', 'Social', 'Direct', 'Email']
    const inputs = names.map((name, i) => new D3PSeries({ bus, name, data: monthly(i + 1, 25, 18).map(([k, v]) => [MONTHS[k], v]) }))
    const stack = new D3PStack({ bus, series: inputs })

    const dx = new D3PAxisDomain({ bus, domain: MONTHS })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    for (const layer of stack.series) auto.linkSeries(layer, [dx, dy])

    // a band axis: one band per month
    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const layers = stack.series.map((layer, i) => new D3PBarRenderer({ bus, series: layer, props: { style: { color: COLORS[i] } } }))

    const cursor = new D3PCursorIndicator({ bus })
    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [x, y, ...layers, cursor, tooltip, legend]
    // #endregion stackedColumn
    return scene({ objects, others: [...inputs, stack, dx, dy, auto], tooltip, legend })
  },
}

const rangeArea: GalleryEntry = {
  id: 'range-area',
  group: 'cartesian',
  build(bus) {
    // #region rangeArea
    const mean = walk(8, 24, 15, 6, 0, 30)
    // each point has a maximum and a minimum: the area is drawn between them
    const band = new D3PSeries({
      bus,
      name: 'min / max',
      columns: ['x', 'max', 'min'],
      data: mean.map((m, i) => [i, m + 5 + (i % 5), m - 4 - (i % 3)]),
    })
    const average = new D3PSeries({ bus, name: 'average', data: mean.map((v, i) => [i, v]) })

    const dx = new D3PAxisDomain({ bus, domain: [0, 23] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(band, [dx, dy]) // the Y domain covers the minima and the maxima
    auto.linkSeries(average, [dx, dy])

    const x = new D3PAxis({ bus, name: 'x', domain: dx, props: { tickFormat: (v: number) => `${Math.round(v)}h` } })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true }, tickFormat: (v: number) => `${d3.format('.1f')(v)}°` } })
    const area = new D3PAreaRenderer({ bus, series: band, props: { base: 'min', style: { color: '#4e79a7', opacity: 0.3, curve: 'monotone' } } })
    const line = new D3PLineRenderer({ bus, series: average, props: { style: { color: '#4e79a7', curve: 'monotone' } } })

    const cursor = new D3PCursorIndicator({ bus })
    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [x, y, area, line, cursor, tooltip, legend]
    // #endregion rangeArea
    return scene({ objects, others: [band, average, dx, dy, auto], tooltip, legend })
  },
}

const histogram: GalleryEntry = {
  id: 'histogram',
  group: 'cartesian',
  build(bus) {
    // #region histogram
    const random = rng(21)
    const gaussian = () => (random() + random() + random() + random() - 2) * 15 + 50
    const samples = new D3PSeries({ bus, name: 'samples', data: Array.from({ length: 400 }, gaussian) })
    // the histogram bins the values; its series has the edges of each bin, which the bars use as widths
    const histogram = new D3PHistogram({ bus, series: samples, thresholds: 16, name: 'count' })

    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(histogram.series, [dx, dy])

    const x = new D3PAxis({ bus, name: 'x', domain: dx })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const bars = new D3PBarRenderer({ bus, series: histogram.series, props: { style: { color: '#59a14f' } } })
    const mean = new D3PAnnotationLine({ bus, axis: x, value: d3.mean(samples.data, (p) => p[1])!, label: 'mean', style: { stroke: '#e15759', strokeDasharray: '4,3' } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, bars, mean, tooltip]
    // #endregion histogram
    return scene({ objects, others: [samples, histogram, dx, dy, auto], tooltip })
  },
}

const horizontalBar: GalleryEntry = {
  id: 'horizontal-bar',
  group: 'cartesian',
  build(bus) {
    // #region horizontalBar
    const data: [string, number][] = [['Python', 82], ['TypeScript', 74], ['Rust', 51], ['Go', 47], ['Kotlin', 33], ['Zig', 12]]
    const popularity = new D3PSeries({ bus, name: 'popularity', data })

    // the values run along the bottom axis, the categories along the left one (a band axis)
    const dv = new D3PAxisDomain({ bus, domain: [0, 100] })
    const dc = new D3PAxisDomain({ bus, domain: data.map((d) => d[0]).reverse() })
    const value = new D3PAxis({ bus, name: 'value', domain: dv, props: { grid: { enabled: true } } })
    const language = new D3PAxis({ bus, name: 'language', domain: dc, position: 'left', scaleType: 'band' })
    const bars = new D3PBarRenderer({ bus, series: popularity, props: { orientation: 'horizontal', style: { color: '#4e79a7' } } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [value, language, bars, tooltip]
    const margin = { left: 90 }
    // #endregion horizontalBar
    return scene({ objects, others: [popularity, dv, dc], tooltip, margin })
  },
}

const lollipop: GalleryEntry = {
  id: 'lollipop',
  group: 'cartesian',
  build(bus) {
    // #region lollipop
    const visits = new D3PSeries({ bus, name: 'visits', data: MONTHS.map((m, i) => [m, Math.round(30 + 45 * Math.abs(Math.sin(i * 0.7)))]) })
    const dx = new D3PAxisDomain({ bus, domain: MONTHS })
    const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const bars = new D3PBarRenderer({ bus, series: visits, props: { style: { shape: 'lollipop', color: '#b07aa1', headRadius: 6 } } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, bars, tooltip]
    // #endregion lollipop
    return scene({ objects, others: [visits, dx, dy], tooltip })
  },
}

const waterfall: GalleryEntry = {
  id: 'waterfall',
  group: 'cartesian',
  build(bus) {
    // #region waterfall
    const steps: [string, number][] = [['Revenue', 420], ['Services', 180], ['Costs', -250], ['Marketing', -90], ['Tax', -60], ['Net', 0]]
    const profit = new D3PSeries({ bus, name: 'profit', data: steps })
    // running sums; "Net" is a total, drawn from zero
    const flow = new D3PWaterfall({ bus, series: profit, totals: ['Net'] })

    const dx = new D3PAxisDomain({ bus, domain: steps.map((s) => s[0]) })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(flow.series, [dx, dy])

    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const bars = new D3PBarRenderer({ bus, series: flow.series, props: { style: { colorBy: 'kind', colors: { up: '#59a14f', down: '#e15759', total: '#4e79a7' } } } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, bars, tooltip]
    // #endregion waterfall
    return scene({ objects, others: [profit, flow, dx, dy, auto], tooltip })
  },
}

const timeline: GalleryEntry = {
  id: 'timeline',
  group: 'cartesian',
  build(bus) {
    // #region timeline
    const tasks: [string, number, number][] = [['Design', 0, 8], ['Backend', 5, 20], ['Frontend', 9, 24], ['Testing', 18, 28], ['Launch', 27, 30]]
    // a bar from `start` to `end`: the primary value is the end, the base is the start
    const plan = new D3PSeries({ bus, name: 'plan', columns: ['x', 'start', 'end'], primary: 'end', data: tasks })

    const dday = new D3PAxisDomain({ bus, domain: [0, 30] })
    const dtask = new D3PAxisDomain({ bus, domain: tasks.map((t) => t[0]).reverse() })
    const day = new D3PAxis({ bus, name: 'day', domain: dday, props: { grid: { enabled: true } } })
    const task = new D3PAxis({ bus, name: 'task', domain: dtask, position: 'left', scaleType: 'band' })
    const bars = new D3PBarRenderer({ bus, series: plan, props: { orientation: 'horizontal', base: 'start', style: { color: '#f28e2b' } } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [day, task, bars, tooltip]
    const margin = { left: 90 }
    // #endregion timeline
    return scene({ objects, others: [plan, dday, dtask], tooltip, margin })
  },
}

const candlestick: GalleryEntry = {
  id: 'candlestick',
  group: 'cartesian',
  build(bus) {
    // #region candlestick
    const closes = walk(14, 60, 100, 8, 60, 140)
    const rows = closes.map((close, i) => {
      const open = i ? closes[i - 1] : close - 1
      return [new Date(Date.UTC(2026, 0, 1 + i)), open, Math.max(open, close) + 2 + (i % 4), Math.min(open, close) - 2 - (i % 3), close]
    })
    // five columns; the close is "the value" (tooltip marker, default domain)
    const prices = new D3PSeries({ bus, name: 'AAPL', columns: ['x', 'open', 'high', 'low', 'close'], primary: 'close', data: rows })
    const average = new D3PSeries({ bus, name: 'SMA 10', data: rows.map((r, i) => [r[0], d3.mean(rows.slice(Math.max(0, i - 9), i + 1), (c) => c[4] as number)]) })

    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(prices, [dx, dy]) // Y covers the lows and the highs
    auto.linkSeries(average, [dx, dy])

    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'time', props: { tickFormat: d3.timeFormat('%b %d') } })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const candles = new D3PCandlestickRenderer({ bus, series: prices })
    const sma = new D3PLineRenderer({ bus, series: average, props: { style: { color: '#f28e2b', curve: 'monotone' } } })

    const cursor = new D3PCursorIndicator({ bus })
    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [x, y, candles, sma, cursor, tooltip, legend]
    // #endregion candlestick
    return scene({ objects, others: [prices, average, dx, dy, auto], tooltip, legend })
  },
}

const boxplot: GalleryEntry = {
  id: 'boxplot',
  group: 'cartesian',
  build(bus) {
    // #region boxplot
    const random = rng(33)
    const sample = (mean: number, spread: number) => Array.from({ length: 40 }, () => mean + (random() + random() + random() - 1.5) * spread + (random() > 0.97 ? spread * 3 : 0))
    const groups: [string, number[]][] = [['Control', sample(50, 20)], ['Dose A', sample(58, 18)], ['Dose B', sample(66, 25)], ['Dose C', sample(48, 12)]]
    // quartiles, whiskers and outliers computed from the raw samples
    const response = new D3PSeries({ bus, name: 'response', columns: [...D3P_BOXPLOT_COLUMNS], primary: 'median', data: d3pBoxPlotRows(groups) })

    const dx = new D3PAxisDomain({ bus, domain: groups.map((g) => g[0]) })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(response, [dx, dy])

    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const boxes = new D3PBoxPlotRenderer({ bus, series: response, props: { style: { color: '#4e79a7' } } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, boxes, tooltip]
    // #endregion boxplot
    return scene({ objects, others: [response, dx, dy, auto], tooltip })
  },
}

const dumbbell: GalleryEntry = {
  id: 'dumbbell',
  group: 'cartesian',
  build(bus) {
    // #region dumbbell
    const data: [string, number, number][] = [['North', 42, 68], ['South', 55, 61], ['East', 38, 74], ['West', 60, 58], ['Central', 47, 80]]
    const satisfaction = new D3PSeries({ bus, name: 'satisfaction', columns: ['x', 'start', 'end'], primary: 'end', data })

    const dscore = new D3PAxisDomain({ bus, domain: [20, 100] })
    const dregion = new D3PAxisDomain({ bus, domain: data.map((d) => d[0]).reverse() })
    const score = new D3PAxis({ bus, name: 'score', domain: dscore, props: { grid: { enabled: true } } })
    const region = new D3PAxis({ bus, name: 'region', domain: dregion, position: 'left', scaleType: 'band' })
    const dumbbells = new D3PDumbbellRenderer({ bus, series: satisfaction, props: { orientation: 'horizontal' } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [score, region, dumbbells, tooltip]
    const margin = { left: 80 }
    // #endregion dumbbell
    return scene({ objects, others: [satisfaction, dscore, dregion], tooltip, margin })
  },
}

const bubble: GalleryEntry = {
  id: 'bubble',
  group: 'cartesian',
  build(bus) {
    // #region bubble
    const random = rng(7)
    // the third column is the size of the bubble
    const countries = new D3PSeries({
      bus,
      name: 'countries',
      columns: ['x', 'y', 'size'],
      data: Array.from({ length: 28 }, () => [10 + random() * 80, 10 + random() * 80, 1 + random() * 99]),
    })

    const dx = new D3PAxisDomain({ bus, domain: [0, 100] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
    const x = new D3PAxis({ bus, name: 'x', domain: dx })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const bubbles = new D3PBubbleRenderer({ bus, series: countries, props: { style: { color: '#e15759' }, radius: [3, 28] } })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, bubbles, tooltip]
    // #endregion bubble
    return scene({ objects, others: [countries, dx, dy], tooltip })
  },
}

const heatmap: GalleryEntry = {
  id: 'heatmap',
  group: 'cartesian',
  build(bus) {
    // #region heatmap
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const hours = Array.from({ length: 12 }, (_, i) => `${i * 2}h`)
    const random = rng(5)
    const rows = days.flatMap((d, di) => hours.map((h, hi) => [h, d, Math.round(10 + 80 * Math.exp(-((hi - 6 - (di > 4 ? 1.5 : 0)) ** 2) / 6) * (di > 4 ? 0.7 : 1) + random() * 12)]))
    // two categories (x, y) and a value, the value being the primary column
    const traffic = new D3PSeries({ bus, name: 'traffic', columns: ['x', 'y', 'value'], primary: 'value', data: rows })

    const dx = new D3PAxisDomain({ bus, domain: hours })
    const dy = new D3PAxisDomain({ bus, domain: [...days].reverse() }) // the first category of a band axis is at the bottom
    const colors = new D3PColorScale({ bus, domain: [0, 100] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(traffic, { x: dx, value: colors.domain }) // the colors follow the values; the days keep their order

    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', scaleType: 'band' })
    const cells = new D3PHeatmapRenderer({ bus, series: traffic, colors })
    const scale = new D3PColorLegend({ bus, scale: colors, title: 'visits' })

    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, cells, scale, tooltip]
    const margin = { right: 70 }
    // #endregion heatmap
    return scene({ objects, others: [traffic, dx, dy, colors, auto], tooltip, margin })
  },
}

const slope: GalleryEntry = {
  id: 'slope',
  group: 'cartesian',
  build(bus) {
    // #region slope
    const data: [string, number, number][] = [['Norway', 62, 71], ['Spain', 48, 66], ['Brazil', 35, 33], ['India', 22, 41], ['Japan', 55, 49], ['Kenya', 18, 29]]
    // blank categories at both ends leave room for the first and last points
    const dx = new D3PAxisDomain({ bus, domain: ['', '2019', '2024', ' '] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 80] })
    const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'point' })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })

    const countries = data.map(([name, from, to]) => new D3PSeries({ bus, name, data: [['2019', from], ['2024', to]] }))
    const lines = countries.map((series, i) => new D3PLineRenderer({ bus, series, props: { style: { color: COLORS[i], strokeWidth: 2.5 } } }))
    const dots = countries.map((series, i) => new D3PScatterRenderer({ bus, series, name: `${series.name} points`, props: { style: { color: COLORS[i], radius: 5 } } }))

    // the legend and the tooltip list the lines: one entry per country, not one per mark
    const tooltip = new D3PTooltip({ bus, series: lines })
    const legend = new D3PLegendBundle({ bus, series: lines })
    const objects = [x, y, ...lines, ...dots, tooltip, legend]
    // #endregion slope
    return scene({ objects, others: [dx, dy, ...countries], tooltip, legend })
  },
}

const annotations: GalleryEntry = {
  id: 'annotations',
  group: 'cartesian',
  build(bus) {
    // #region annotations
    const load = new D3PSeries({ bus, name: 'load', data: walk(3, 40, 60, 22, 20, 95) })
    const dx = new D3PAxisDomain({ bus, domain: [0, 39] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
    const x = new D3PAxis({ bus, name: 'x', domain: dx })
    const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
    const line = new D3PLineRenderer({ bus, series: load, props: { style: { color: '#4e79a7', curve: 'monotone' } } })

    // marks tied to values of the axes: they follow zooms and resizes
    const deploy = new D3PAnnotationBand({ bus, axis: x, from: 14, to: 20, label: 'deploy', style: { fill: '#4e79a7', opacity: 0.15 } })
    const limit = new D3PAnnotationLine({ bus, axis: y, value: 80, label: 'limit', style: { strokeDasharray: '6,4' } })
    const peak = load.data.reduce((best, p) => (p[1] > best[1] ? p : best))
    const top = new D3PAnnotationPoint({ bus, x: peak[0] as number, y: peak[1], label: `peak ${Math.round(peak[1])}`, radius: 5 })

    const cursor = new D3PCursorIndicator({ bus })
    const tooltip = new D3PTooltip({ bus })
    const objects = [x, y, deploy, line, limit, top, cursor, tooltip]
    // #endregion annotations
    return scene({ objects, others: [load, dx, dy], tooltip })
  },
}

// ---------------------------------------------------------------------------
// Polar
// ---------------------------------------------------------------------------

const radar: GalleryEntry = {
  id: 'radar',
  group: 'polar',
  build(bus) {
    // #region radar
    const skills = ['Attack', 'Defense', 'Speed', 'Stamina', 'Skill', 'Luck']
    const warrior = new D3PSeries({ bus, name: 'Warrior', data: skills.map((s, i) => [s, [8, 7, 4, 8, 5, 3][i]]) })
    const rogue = new D3PSeries({ bus, name: 'Rogue', data: skills.map((s, i) => [s, [5, 3, 9, 5, 8, 7][i]]) })

    // the categories are on the angle, drawn as a polygon with polygonal grid rings
    const dskill = new D3PAxisDomain({ bus, domain: skills })
    const dlevel = new D3PAxisDomain({ bus, domain: [0, 10] })
    const skill = new D3PAxis({ bus, name: 'skill', domain: dskill, position: 'angle', scaleType: 'band', renderer: new D3PRadarAngleAxisRenderer(), props: { grid: { enabled: true } } })
    const level = new D3PRadiusAxis({ bus, name: 'level', domain: dlevel, props: { tickCount: 5 } })

    // a closed outline joined by straight segments, filled, with a dot per skill
    const lines: D3PLineRenderer[] = []
    const marks = [warrior, rogue].flatMap((series, i) => {
      const style = { color: COLORS[i * 2], curve: 'straight' as const, closed: true }
      const line = new D3PLineRenderer({ bus, series, props: { style } })
      lines.push(line)
      return [
        new D3PAreaRenderer({ bus, series, name: `${series.name} area`, props: { style: { ...style, opacity: 0.2 } } }),
        line,
        new D3PScatterRenderer({ bus, series, name: `${series.name} points`, props: { style: { color: style.color, radius: 3 } } }),
      ]
    })

    const tooltip = new D3PTooltip({ bus, series: lines })
    const legend = new D3PLegendBundle({ bus, series: lines })
    const objects = [skill, level, ...marks, tooltip, legend]
    // #endregion radar
    return scene({ objects, others: [dskill, dlevel, warrior, rogue], tooltip, legend })
  },
}

const polarArea: GalleryEntry = {
  id: 'polar-area',
  group: 'polar',
  build(bus) {
    // #region polarArea
    const names = ['Rain', 'Snow', 'Sun']
    const inputs = names.map((name, i) => new D3PSeries({ bus, name, data: MONTHS.map((m, k) => [m, Math.round(8 + 14 * Math.abs(Math.sin((k + i * 3) * 0.55)))]) }))
    const stack = new D3PStack({ bus, series: inputs })

    const dmonth = new D3PAxisDomain({ bus, domain: MONTHS })
    const ddays = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    for (const layer of stack.series) auto.linkSeries(layer, [dmonth, ddays])

    // bars on polar axes are the sectors of a rose
    const monthAxis = new D3PAxis({ bus, name: 'month', domain: dmonth, position: 'angle', scaleType: 'band', props: { grid: { enabled: true } } })
    const days = new D3PRadiusAxis({ bus, name: 'days', domain: ddays, props: { tickCount: 4, grid: { enabled: true } } })
    const layers = stack.series.map((layer, i) => new D3PBarRenderer({ bus, series: layer, props: { style: { color: COLORS[i + 4], barWidth: 0.96 } } }))

    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [monthAxis, days, ...layers, tooltip, legend]
    // #endregion polarArea
    return scene({ objects, others: [...inputs, stack, dmonth, ddays, auto], tooltip, legend })
  },
}

/** Radial bars: one ring per category, the value being an angle. */
const radialBar: GalleryEntry = {
  id: 'radial-bar',
  group: 'polar',
  build(bus) {
    // #region radialBar
    const rings: [string, number][] = [['Move', 82], ['Exercise', 64], ['Stand', 91], ['Sleep', 47]]
    const categories = rings.map((c) => c[0])
    // the polar system sets the part of the circle (sweep), where it starts, and the hole
    const system = new D3PPolarSystem({ bus, props: { startAngle: 0, sweep: 270, innerRadius: 0.2, padding: 30 } })
    const track = new D3PSeries({ bus, name: 'track', data: categories.map((c) => [c, 100]) })
    const value = new D3PSeries({ bus, name: 'value', data: rings })

    const dpercent = new D3PAxisDomain({ bus, domain: [0, 100] })
    const dcategory = new D3PAxisDomain({ bus, domain: [...categories].reverse() })
    const percent = new D3PAxis({ bus, name: 'percent', domain: dpercent, position: 'angle', props: { tickCount: 4 } })
    const category = new D3PAxis({ bus, name: 'category', domain: dcategory, position: 'radius', scaleType: 'band' })
    // `horizontal`: the category is on the radius, the value on the angle
    const background = new D3PBarRenderer({ bus, series: track, name: 'track', props: { orientation: 'horizontal', style: { color: '#e6e6e6', barWidth: 0.85 } } })
    const bars = new D3PBarRenderer({ bus, series: value, name: 'value', props: { orientation: 'horizontal', style: { color: '#4e79a7', barWidth: 0.85 } } })

    const tooltip = new D3PTooltip({ bus, series: [bars] }) // the track is background, not data
    const objects = [system, percent, category, background, bars, tooltip]
    // #endregion radialBar
    return scene({ objects, others: [track, value, dpercent, dcategory], tooltip })
  },
}

/** A half circle with one ring: a gauge. */
const gauge: GalleryEntry = {
  id: 'gauge',
  group: 'polar',
  build(bus) {
    // #region gauge
    const load = 72
    // half a circle, starting on the left, lowered so that it sits in the middle of the chart
    const system = new D3PPolarSystem({ bus, props: { startAngle: 270, sweep: 180, innerRadius: 0.55, padding: 40, shift: [0, 0.5] } })
    const track = new D3PSeries({ bus, name: 'track', data: [['Load', 100]] })
    const value = new D3PSeries({ bus, name: 'value', data: [['Load', load]] })

    const dpercent = new D3PAxisDomain({ bus, domain: [0, 100] })
    const dcategory = new D3PAxisDomain({ bus, domain: ['Load'] })
    const percent = new D3PAxis({ bus, name: 'percent', domain: dpercent, position: 'angle', props: { tickCount: 5 } })
    const category = new D3PAxis({ bus, name: 'category', domain: dcategory, position: 'radius', scaleType: 'band', props: { tickFormat: () => '' } })
    const background = new D3PBarRenderer({ bus, series: track, name: 'track', props: { orientation: 'horizontal', style: { color: '#e6e6e6', barWidth: 0.85 } } })
    const bars = new D3PBarRenderer({ bus, series: value, name: 'value', props: { orientation: 'horizontal', style: { color: '#59a14f', barWidth: 0.85 } } })
    const label = new D3PAnnotationText({ bus, at: 'polar', dy: -24, text: `${load} %`, style: { fontSize: 34 } })

    const tooltip = new D3PTooltip({ bus, series: [bars] })
    const objects = [system, percent, category, background, bars, label, tooltip]
    // #endregion gauge
    return scene({ objects, others: [track, value, dpercent, dcategory], tooltip })
  },
}

const semiDonut: GalleryEntry = {
  id: 'semi-donut',
  group: 'polar',
  build(bus) {
    // #region semiDonut
    const seats = new D3PSeries({ bus, name: 'seats', data: [['Left', 142], ['Greens', 58], ['Centre', 96], ['Right', 118], ['Other', 22]] })
    // a pie in a polar system covering half a circle, with a hole
    const system = new D3PPolarSystem({ bus, props: { startAngle: 270, sweep: 180, innerRadius: 0.5, padding: 20, shift: [0, 0.5] } })
    const pie = new D3PPieRenderer({ bus, series: seats, props: { padAngle: 1, cornerRadius: 3 } })

    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [system, pie, tooltip, legend]
    // #endregion semiDonut
    return scene({ objects, others: [seats], tooltip, legend })
  },
}

// ---------------------------------------------------------------------------
// No axes
// ---------------------------------------------------------------------------

const funnel: GalleryEntry = {
  id: 'funnel',
  group: 'noaxes',
  build(bus) {
    // #region funnel
    const conversion = new D3PSeries({ bus, name: 'conversion', data: [['Visits', 12000], ['Sign-ups', 4200], ['Activated', 2600], ['Trial', 1100], ['Paid', 430]] })
    const stages = new D3PFunnelRenderer({ bus, series: conversion })

    const tooltip = new D3PTooltip({ bus })
    const legend = new D3PLegendBundle({ bus })
    const objects = [stages, tooltip, legend]
    const margin = { left: 20, right: 20 }
    // #endregion funnel
    return scene({ objects, others: [conversion], tooltip, legend, margin })
  },
}

export const GALLERY: GalleryEntry[] = [
  curves,
  stackedArea('stacked-area', {}),
  stackedArea('percent-area', { offset: 'expand' }),
  stackedArea('streamgraph', { offset: 'wiggle', order: 'insideOut' }),
  stackedColumn,
  rangeArea,
  histogram,
  horizontalBar,
  lollipop,
  waterfall,
  timeline,
  candlestick,
  boxplot,
  dumbbell,
  bubble,
  heatmap,
  slope,
  annotations,
  radar,
  polarArea,
  radialBar,
  gauge,
  semiDonut,
  funnel,
]
