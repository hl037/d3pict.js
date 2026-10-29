import * as d3 from 'd3'
import {
  D3PAnnotationBand, D3PAnnotationLine, D3PAnnotationPoint, D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PBarRenderer,
  D3PCandlestickRenderer, D3PColorLegend, D3PColorScale, D3PCursorIndicator, D3PHeatmapRenderer, D3PLegendPanel, D3PLineRenderer, D3PPanTool, D3PPieRenderer,
  D3PPolarSystem, D3PRadiusAxis, D3PResetTool, D3PScatterRenderer, D3PSeries, D3PStack, D3PTitle, D3PToolbox, D3PTooltip, D3PWheelZoomTool, d3pSettle, type D3PBus,
  type D3PChartObject, type D3PMargin, type D3PPoint,
} from '../../src'
import { rng, walk } from '../shared/data'
import { destroyAll } from './destroy'

/**
 * Seven charts that combine most of the features of the library, each with its title, the titles of its
 * axes and a legend:
 *
 * 1. time series on four Y axes (two on each side, one logarithmic) and two X axes: bars, a
 *    spline with a gap, a range area, points, annotations, pan and wheel zoom;
 * 2. categories on a band axis: grouped columns, a line on a second axis, an annotation;
 * 3. two polar systems in one chart: a stacked rose, and a donut at its center;
 * 4. and 5. a candlestick chart and its volume, two charts sharing one X axis;
 * 6. a heatmap with its color scale;
 * 7. a line of 1 000, 10 000 or 100 000 points, with the time it took to draw it.
 *
 * Each chart names its axes differently, so the pointer only carries over from one chart to
 * another where an axis is shared (4 and 5).
 */
export function createShowcaseScenario(bus: D3PBus) {
  // #region helpers
  /** The numbers of the first and the last (excluded) category of a chart, and a phase that changes its values. */
  type Span = { from: number; to: number; phase: number }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hours = 120
  const start = Date.UTC(2026, 0, 5)
  const hourly = (values: number[]): [Date, number][] => values.map((v, i) => [new Date(start + i * 3_600_000), v])
  const grid = { enabled: true }
  const tint = (color: string) => ({ postProcess: (g: d3.Selection<SVGGElement, unknown, null, undefined>) => void g.style('color', color) })
  // #endregion helpers
  // #region chart
  // 1. time series: four Y axes (one logarithmic) and two X axes
  const requests = new D3PSeries({ bus, name: 'requests', data: hourly(walk(21, hours, 800, 140, 100, 1500)) })
  // a hole in the data: the line breaks there
  const cpu = new D3PSeries({ bus, name: 'cpu', data: hourly(walk(22, hours, 45, 14, 5, 95).map((v, i) => (i >= 60 && i < 66 ? NaN : v))) })
  // a range: two columns, the area is drawn between them
  const latency = new D3PSeries({
    bus,
    name: 'latency',
    columns: ['x', 'p95', 'p50'],
    data: walk(23, hours, 1.6, 0.5, 0.5, 3.3).map((v, i) => [new Date(start + i * 3_600_000), 10 ** (v + 0.4), 10 ** v]),
  })
  const errors = new D3PSeries({ bus, name: 'errors', data: hourly(walk(24, hours, 2, 1.4, 0, 9)) })

  // both X axes read one domain, so zooming one moves the other; it fits the data again when the data changes
  const time = new D3PAxisDomain({ bus, domain: [new Date(start), new Date(start + (hours - 1) * 3_600_000)] })
  const fitTime = new D3PAutoDomain({ bus })
  for (const series of [requests, cpu, latency, errors]) fitTime.linkSeries(series, [time, null])
  const hour = new D3PAxis({ bus, name: 'hour', domain: time, scaleType: 'time', props: { tickFormat: d3.timeFormat('%H:%M'), grid } })
  const day = new D3PAxis({ bus, name: 'day', domain: time, scaleType: 'time', position: 'top', props: { tickFormat: d3.timeFormat('%a %d'), tickCount: 5 } })
  // `offset` stacks a second axis on a side; each axis has the color of its series
  const yRequests = new D3PAxis({ bus, name: 'requests', domain: new D3PAxisDomain({ bus, domain: [0, 1600] }), position: 'left', props: { displayName: 'requests/h', ...tint('#4e79a7'), grid } })
  const yCpu = new D3PAxis({ bus, name: 'cpu', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left', offset: 84, props: { displayName: 'cpu', tickFormat: (v) => `${Math.round(v)} %`, ...tint('#f28e2b') } })
  const yLatency = new D3PAxis({ bus, name: 'latency', domain: new D3PAxisDomain({ bus, domain: [3, 3000] }), position: 'right', scaleType: 'log', props: { displayName: 'latency', tickFormat: (v) => `${d3.format('.3~s')(v)} ms`, tickCount: 3, ...tint('#e15759') } })
  const yErrors = new D3PAxis({ bus, name: 'errors', domain: new D3PAxisDomain({ bus, domain: [0, 10] }), position: 'right', offset: 84, props: { displayName: 'errors', tickFormat: (v) => `${Math.round(v)} %`, ...tint('#59a14f') } })

  // a renderer names the axes it draws against
  const requestBars = new D3PBarRenderer({ bus, series: requests, axes: ['hour', 'requests'], props: { style: { color: '#4e79a7', barWidth: 4 } } })
  const cpuLine = new D3PLineRenderer({ bus, series: cpu, axes: ['hour', 'cpu'], props: { style: { color: '#f28e2b', curve: 'monotone', gaps: 'break' } } })
  const latencyRange = new D3PAreaRenderer({ bus, series: latency, axes: ['hour', 'latency'], props: { base: 'p50', style: { color: '#e15759', opacity: 0.3, curve: 'monotone' } } })
  const errorDots = new D3PScatterRenderer({ bus, series: errors, axes: ['hour', 'errors'], props: { style: { color: '#59a14f', radius: 2.5 } } })

  // marks tied to values of the axes: they follow zooms and resizes
  const peak = requests.data.reduce((best, p) => (p[1] > best[1] ? p : best))
  const deploy = new D3PAnnotationBand({ bus, axis: hour, from: new Date(start + 30 * 3_600_000), to: new Date(start + 36 * 3_600_000), label: 'deploy', style: { fill: '#888', opacity: 0.15 } })
  const slo = new D3PAnnotationLine({ bus, axis: yLatency, value: 1000, label: 'SLO 1 s', style: { strokeDasharray: '6,4' } })
  const top = new D3PAnnotationPoint({ bus, xAxis: hour, yAxis: yRequests, x: peak[0], y: peak[1], label: 'peak', radius: 5 })

  // a title, a title for each Y axis in the color of its series (against its own labels), and a legend
  const title1 = new D3PTitle({ bus, props: { text: 'Service metrics', subtitle: 'requests, cpu, latency and errors over five days' } })
  const titleRequests = new D3PAxisTitle({ bus, axis: yRequests, props: { style: { color: '#4e79a7' } } })
  const titleCpu = new D3PAxisTitle({ bus, axis: yCpu, props: { style: { color: '#f28e2b' } } })
  const titleLatency = new D3PAxisTitle({ bus, axis: yLatency, props: { style: { color: '#e15759' } } })
  const titleErrors = new D3PAxisTitle({ bus, axis: yErrors, props: { style: { color: '#59a14f' } } })
  const legend1 = new D3PLegendPanel({ bus, placement: 'bottom' })
  // a cursor and a tooltip, attached to every chart
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })
  // pan and zoom along the time only: the Y ranges stay
  const timeTools = new D3PToolbox({ bus })
  timeTools.addTool(new D3PPanTool({ bus, axes: ['hour'] }))
  timeTools.addTool(new D3PWheelZoomTool({ bus, axes: ['hour'] }))
  timeTools.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) timeTools.setToolActive(name)

  // 2. categories: grouped columns, and a line on a second Y axis
  // each value is a function of the number of the quarter, so a quarter keeps its values when the others change
  const quarterName = (i: number) => `Q${(i % 4) + 1} ${2025 + Math.floor(i / 4)}`
  const sales2025 = new D3PSeries({ bus, name: 'product A', data: [] })
  const sales2026 = new D3PSeries({ bus, name: 'product B', data: [] })
  const margin = new D3PSeries({ bus, name: 'margin', data: [] })
  const setQuarters = ({ from, to, phase }: Span) => {
    const numbers = Array.from({ length: to - from }, (_, k) => from + k)
    sales2025.data = numbers.map((i) => [quarterName(i), 30 + 25 * Math.abs(Math.sin(i * 0.8 + phase))])
    sales2026.data = numbers.map((i) => [quarterName(i), 22 + 30 * Math.abs(Math.cos(i * 0.6 + phase))])
    margin.data = numbers.map((i) => [quarterName(i), 12 + 10 * Math.sin(i * 0.5 + phase)])
  }
  const quarters = new D3PAxisDomain({ bus, domain: [] })
  const fitQuarters = new D3PAutoDomain({ bus })
  fitQuarters.linkSeries(sales2025, [quarters, null]) // the categories are the ones of the data
  const quarterSpan = { from: 0, to: 8, phase: 0 }
  setQuarters(quarterSpan)

  const quarter = new D3PAxis({ bus, name: 'quarter', domain: quarters, scaleType: 'band' })
  const ySales = new D3PAxis({ bus, name: 'sales', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left', props: { grid } })
  const yMargin = new D3PAxis({ bus, name: 'margin', domain: new D3PAxisDomain({ bus, domain: [0, 40] }), position: 'right', props: { displayName: 'margin (%)', tickFormat: (v) => `${Math.round(v)} %`, ...tint('#b07aa1') } })
  // `count` and `index` put the columns of several series side by side in each band
  const columnsA = new D3PBarRenderer({ bus, series: sales2025, axes: ['quarter', 'sales'], props: { count: 2, index: 1, style: { color: '#4e79a7', margin: 0.1 } } })
  const columnsB = new D3PBarRenderer({ bus, series: sales2026, axes: ['quarter', 'sales'], props: { count: 2, index: 2, style: { color: '#76b7b2', margin: 0.1 } } })
  const marginLine = new D3PLineRenderer({ bus, series: margin, axes: ['quarter', 'margin'], props: { style: { color: '#b07aa1', curve: 'monotone', strokeWidth: 2.5 } } })
  const target = new D3PAnnotationLine({ bus, axis: ySales, value: 60, label: 'target', style: { strokeDasharray: '6,4' } })
  const title2 = new D3PTitle({ bus, props: { text: 'Sales and margin' } })
  const titleSales = new D3PAxisTitle({ bus, axis: ySales, props: { text: 'sales (k€)' } })
  const titleMargin = new D3PAxisTitle({ bus, axis: yMargin, props: { style: { color: '#b07aa1' } } })
  const legend2 = new D3PLegendPanel({ bus, placement: 'bottom' })

  // 3. two polar systems in one chart: a stacked rose, and a donut in its center
  const monthName = (k: number) => (k < 12 ? MONTHS[k] : `${MONTHS[k % 12]} ${Math.floor(k / 12) + 1}`)
  const weather = ['Rain', 'Snow', 'Sun'].map((name) => new D3PSeries({ bus, name, data: [] }))
  const setMonths = ({ from, to, phase }: Span) =>
    weather.forEach((layer, i) => {
      layer.data = Array.from({ length: to - from }, (_, k) => [monthName(from + k), Math.round(8 + 14 * Math.abs(Math.sin((from + k + i * 3) * 0.55 + phase)))])
    })
  const monthSpan = { from: 0, to: 12, phase: 0 }
  setMonths(monthSpan)
  const stack = new D3PStack({ bus, series: weather })
  const dMonth = new D3PAxisDomain({ bus, domain: MONTHS })
  const dDays = new D3PAxisDomain({ bus, domain: [0, 1] })
  const fit = new D3PAutoDomain({ bus })
  for (const layer of stack.series) fit.linkSeries(layer, [dMonth, dDays])

  // the axes use the default `polar` system; the pie draws in a second one, named and smaller (more padding)
  const donut = new D3PPolarSystem({ bus, name: 'donut', props: { padding: 100, innerRadius: 0.5 } })
  const month = new D3PAxis({ bus, name: 'month', domain: dMonth, position: 'angle', scaleType: 'band', props: { grid } })
  const days = new D3PRadiusAxis({ bus, name: 'days', domain: dDays, props: { tickCount: 4, grid } })
  const rose = stack.series.map((layer, i) => new D3PBarRenderer({ bus, series: layer, props: { style: { color: d3.schemeTableau10[i + 4], barWidth: 0.96 } } }))
  const regionName = (i: number) => ['North', 'South', 'East', 'West', 'Center', 'Coast', 'Plains', 'Islands'][i] ?? `Region ${i + 1}`
  const shares = new D3PSeries({ bus, name: 'shares', data: [] })
  const setRegions = ({ from, to, phase }: Span) => {
    shares.data = Array.from({ length: to - from }, (_, k) => [regionName(from + k), Math.round(12 + 30 * Math.abs(Math.sin((from + k) * 1.7 + 0.9 + phase)))])
  }
  const regionSpan = { from: 0, to: 4, phase: 0 }
  setRegions(regionSpan)
  const pie = new D3PPieRenderer({ bus, series: shares, system: 'donut', props: { padAngle: 1, cornerRadius: 3, labels: { enabled: false } } })
  // titles for polar axes go along a side of the chart: the angle under it, the radius on its left
  const title3 = new D3PTitle({ bus, props: { text: 'Weather by month', subtitle: 'and the shares of four regions, at the center' } })
  const titleMonth = new D3PAxisTitle({ bus, axis: month, props: { text: 'month' } })
  const titleDays = new D3PAxisTitle({ bus, axis: days, props: { text: 'days' } })
  const legend3 = new D3PLegendPanel({ bus, placement: 'right' })

  // 4. and 5. a candlestick chart and its volume, two charts sharing one X axis
  const random = rng(14)
  const dayAt = (i: number) => new Date(Date.UTC(2026, 0, 1 + i))
  // a day from the close of the day before and its own close
  const candle = (i: number, open: number, close: number): D3PPoint => [dayAt(i), open, Math.max(open, close) + 2 + (i % 4), Math.min(open, close) - 2 - (i % 3), close]
  const candlesFrom = (seed: number, days: number) => {
    const closes = walk(seed, days, 100, 8, 60, 140)
    return closes.map((close, i) => candle(i, i ? closes[i - 1] : close - 1, close))
  }
  const rows = candlesFrom(14, 60)
  const prices = new D3PSeries({ bus, name: 'AAPL', columns: ['x', 'open', 'high', 'low', 'close'], primary: 'close', data: rows })
  const movingAverage = (candles: D3PPoint[]): D3PPoint[] => candles.map((r, i) => [r[0], d3.mean(candles.slice(Math.max(0, i - 9), i + 1), (c) => c[4] as number) ?? NaN])
  const average = new D3PSeries({ bus, name: 'SMA 10', data: movingAverage(rows) })
  const volume = new D3PSeries({ bus, name: 'volume', data: rows.map((r) => [r[0], Math.round(20 + random() * 80)]) })

  const dDate = new D3PAxisDomain({ bus, domain: [rows[0][0], rows[rows.length - 1][0]] })
  const dPrice = new D3PAxisDomain({ bus, domain: [0, 1] })
  const dVolume = new D3PAxisDomain({ bus, domain: [0, 100] })
  const follow = new D3PAutoDomain({ bus })
  follow.linkSeries(prices, [dDate, dPrice]) // the price axis covers the lows and the highs
  follow.linkSeries(average, [dDate, dPrice])
  // the same axis object is attached to both charts
  const date = new D3PAxis({ bus, name: 'date', domain: dDate, scaleType: 'time', props: { tickFormat: d3.timeFormat('%b %d') } })
  const yPrice = new D3PAxis({ bus, name: 'price', domain: dPrice, position: 'left', props: { grid } })
  const yVolume = new D3PAxis({ bus, name: 'volume', domain: dVolume, position: 'left' })
  const candles = new D3PCandlestickRenderer({ bus, series: prices, axes: ['date', 'price'] })
  const sma = new D3PLineRenderer({ bus, series: average, axes: ['date', 'price'], props: { style: { color: '#f28e2b', curve: 'monotone' } } })
  const volumeBars = new D3PBarRenderer({ bus, series: volume, axes: ['date', 'volume'], props: { style: { color: '#76b7b2', barWidth: 6 } } })
  const title4 = new D3PTitle({ bus, props: { text: 'AAPL', subtitle: 'with its volume below: the two charts share one X axis' } })
  const titlePrice = new D3PAxisTitle({ bus, axis: yPrice, props: { text: 'price ($)' } })
  const titleVolume = new D3PAxisTitle({ bus, axis: yVolume, props: { text: 'volume' } })
  const titleDate = new D3PAxisTitle({ bus, axis: date, props: { text: 'date' } })
  // a legend in a corner of the plot takes no room from it
  const legend4 = new D3PLegendPanel({ bus, placement: 'top-left' })
  const marketTools = new D3PToolbox({ bus })
  marketTools.addTool(new D3PPanTool({ bus, axes: ['date'] }))
  marketTools.addTool(new D3PWheelZoomTool({ bus, axes: ['date'] }))
  marketTools.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) marketTools.setToolActive(name)

  // 6. a heatmap: two categories and a value, colored by a scale
  const days7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours12 = Array.from({ length: 12 }, (_, i) => `${i * 2}h`)
  const hourName = (hi: number) => `${hi * 2}h`
  const traffic = new D3PSeries({ bus, name: 'traffic', columns: ['x', 'y', 'value'], primary: 'value', data: [] })
  // the noise depends on the cell, so a cell keeps its value when the others change
  const setTraffic = ({ from, to, phase }: Span) => {
    traffic.data = days7.flatMap((d, di) =>
      Array.from({ length: to - from }, (_, k) => {
        const hi = from + k
        const noise = Math.abs(Math.sin(hi * 12.9898 + di * 78.233 + phase)) % 1
        return [hourName(hi), d, Math.round(10 + 80 * Math.exp(-(((hi % 12) - 6 - (di > 4 ? 1.5 : 0)) ** 2) / 6) * (di > 4 ? 0.7 : 1) + noise * 12)]
      }),
    )
  }
  const trafficSpan = { from: 0, to: 12, phase: 0 }
  setTraffic(trafficSpan)
  const dHour = new D3PAxisDomain({ bus, domain: hours12 })
  const dWeekday = new D3PAxisDomain({ bus, domain: [...days7].reverse() })
  const colors = new D3PColorScale({ bus, domain: [0, 100] })
  const colorFit = new D3PAutoDomain({ bus })
  colorFit.linkSeries(traffic, { x: dHour, value: colors.domain }) // the colors follow the values; the days keep their order
  const hourOfDay = new D3PAxis({ bus, name: 'time of day', domain: dHour, scaleType: 'band' })
  const weekday = new D3PAxis({ bus, name: 'weekday', domain: dWeekday, position: 'left', scaleType: 'band' })
  const cells = new D3PHeatmapRenderer({ bus, series: traffic, colors })
  const scale = new D3PColorLegend({ bus, scale: colors, title: 'visits' })
  const title6 = new D3PTitle({ bus, props: { text: 'Visits by hour and day' } })
  const titleHour = new D3PAxisTitle({ bus, axis: hourOfDay, props: { text: 'time of day' } })
  const titleWeekday = new D3PAxisTitle({ bus, axis: weekday, props: { text: 'weekday' } })

  // changing the data: one set of buttons for all the charts. The series are assigned, and what draws them,
  // and the axes that fit them, follow with an animation
  const chaos = rng(77)
  const drift = (value: number, spread: number, min: number, max: number) => Math.min(max, Math.max(min, value + (chaos() - 0.5) * spread))
  // a chart whose data is a span of categories: it grows, shrinks at either end, or starts again (up to `longest` categories) from another phase
  const spanned = (span: Span, redraw: (span: Span) => void, longest: number) => ({
    add: () => (span.to++, redraw(span)),
    removeLast: () => span.to - span.from > 2 && (span.to--, redraw(span)),
    removeFirst: () => span.to - span.from > 2 && (span.from++, redraw(span)),
    replace: () => ((span.from = 0), (span.to = 4 + Math.floor(chaos() * (longest - 4))), (span.phase = chaos() * 6), redraw(span)),
  })
  const hourlyRows = (n: number) => ({ requests: walk(Math.floor(chaos() * 1e6), n, 800, 140, 100, 1500), cpu: walk(Math.floor(chaos() * 1e6), n, 45, 14, 5, 95), p50: walk(Math.floor(chaos() * 1e6), n, 1.6, 0.5, 0.5, 3.3), errors: walk(Math.floor(chaos() * 1e6), n, 2, 1.4, 0, 9) })
  const setHours = (n: number) => {
    const v = hourlyRows(n)
    requests.data = hourly(v.requests)
    cpu.data = hourly(v.cpu)
    latency.data = v.p50.map((p, i) => [new Date(start + i * 3_600_000), 10 ** (p + 0.4), 10 ** p])
    errors.data = hourly(v.errors)
  }
  const hoursFamily = {
    add: () => {
      const at = new Date(+requests.data[requests.data.length - 1][0] + 3_600_000)
      const last = <T,>(series: D3PSeries, column: number, fallback: T) => (Number.isFinite(series.data.at(-1)![column]) ? series.data.at(-1)![column] : fallback)
      requests.data = [...requests.data, [at, drift(last(requests, 1, 800), 280, 100, 1500)]]
      cpu.data = [...cpu.data, [at, drift(last(cpu, 1, 45), 28, 5, 95)]]
      const p50 = drift(Math.log10(last(latency, 2, 40)), 1, 0.5, 3.3)
      latency.data = [...latency.data, [at, 10 ** (p50 + 0.4), 10 ** p50]]
      errors.data = [...errors.data, [at, drift(last(errors, 1, 2), 2.8, 0, 9)]]
    },
    removeLast: () => hourSeries.forEach((series) => series.data.length > 3 && (series.data = series.data.slice(0, -1))),
    removeFirst: () => hourSeries.forEach((series) => series.data.length > 3 && (series.data = series.data.slice(1))),
    replace: () => setHours(60 + Math.floor(chaos() * 80)),
  }
  const hourSeries = [requests, cpu, latency, errors]
  const setMarket = (candles: D3PPoint[], volumes: D3PPoint[]) => {
    prices.data = candles
    average.data = movingAverage(candles)
    volume.data = volumes
  }
  const marketFamily = {
    add: () => {
      const last = prices.data[prices.data.length - 1]
      const i = Math.round((+last[0] - +dayAt(0)) / 86_400_000) + 1
      setMarket([...prices.data, candle(i, last[4], drift(last[4], 16, 60, 140))], [...volume.data, [dayAt(i), Math.round(20 + chaos() * 80)]])
    },
    removeLast: () => prices.data.length > 5 && setMarket(prices.data.slice(0, -1), volume.data.slice(0, -1)),
    removeFirst: () => prices.data.length > 5 && setMarket(prices.data.slice(1), volume.data.slice(1)),
    replace: () => {
      const candles = candlesFrom(Math.floor(chaos() * 1e6), 30 + Math.floor(chaos() * 50))
      setMarket(candles, candles.map((c) => [c[0], Math.round(20 + chaos() * 80)]))
    },
  }
  const families = [hoursFamily, spanned(quarterSpan, setQuarters, 14), spanned(monthSpan, setMonths, 24), spanned(regionSpan, setRegions, 8), marketFamily, spanned(trafficSpan, setTraffic, 18)]
  const actions: Record<string, () => void> = {
    'add a point': () => families.forEach((f) => f.add()),
    'remove the last': () => families.forEach((f) => f.removeLast()),
    'remove the first': () => families.forEach((f) => f.removeFirst()),
    replace: () => families.forEach((f) => f.replace()),
  }

  // 7. many points: one line, to see what a chart costs as the data grows
  const sizes = [1_000, 10_000, 100_000]
  const signal = new D3PSeries({ bus, name: 'signal', data: [] })
  const signalRows = (n: number): D3PPoint[] => walk(31, n, 0, 8, -100, 100).map((v, i) => [new Date(start + i * 60_000), v])
  const dSignalTime = new D3PAxisDomain({ bus, domain: [new Date(start), new Date(start + 60_000)] })
  const dSignal = new D3PAxisDomain({ bus, domain: [-100, 100] })
  const fitSignal = new D3PAutoDomain({ bus })
  fitSignal.linkSeries(signal, [dSignalTime, null])
  const signalTime = new D3PAxis({ bus, name: 'signal time', domain: dSignalTime, scaleType: 'time', props: { grid } })
  const signalValue = new D3PAxis({ bus, name: 'signal value', domain: dSignal, position: 'left', props: { grid } })
  const signalLine = new D3PLineRenderer({ bus, series: signal, axes: ['signal time', 'signal value'], props: { style: { color: '#4e79a7', strokeWidth: 1.25 } } })
  const title7 = new D3PTitle({ bus, props: { text: 'Many points' } })
  const signalTools = new D3PToolbox({ bus })
  signalTools.addTool(new D3PPanTool({ bus, axes: ['signal time'] }))
  signalTools.addTool(new D3PWheelZoomTool({ bus, axes: ['signal time'] }))
  signalTools.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) signalTools.setToolActive(name)
  // a number of points: generate them, assign them, and say how long the chart took to draw them
  const setSize = async (n: number) => {
    const began = performance.now()
    signal.data = signalRows(n)
    await d3pSettle(bus)
    const ms = Math.round(performance.now() - began)
    title7.props({ subtitle: `${n.toLocaleString('en')} points, drawn in ${ms} ms (generation included)` })
  }
  signal.data = signalRows(sizes[0])
  title7.props({ subtitle: `${sizes[0].toLocaleString('en')} points` })

  // what goes on each chart, and the margins its axes need
  // `name` is what a chart is saved as: `service-metrics.svg`, `service-metrics.png`
  const charts: { name: string; objects: D3PChartObject[]; margin?: Partial<D3PMargin> }[] = [
    { name: 'service-metrics', objects: [hour, day, yRequests, yCpu, yLatency, yErrors, requestBars, latencyRange, cpuLine, errorDots, deploy, slo, top, title1, titleRequests, titleCpu, titleLatency, titleErrors, legend1, cursor, tooltip, timeTools] },
    { name: 'sales-and-margin', objects: [quarter, ySales, yMargin, columnsA, columnsB, marginLine, target, title2, titleSales, titleMargin, legend2, cursor, tooltip] },
    { name: 'weather-by-month', objects: [donut, month, days, ...rose, pie, title3, titleMonth, titleDays, legend3, cursor, tooltip] },
    { name: 'aapl-prices', objects: [date, yPrice, candles, sma, title4, titlePrice, legend4, cursor, tooltip, marketTools] },
    { name: 'aapl-volume', objects: [date, yVolume, volumeBars, titleVolume, titleDate, cursor, tooltip, marketTools] },
    { name: 'visits-by-hour-and-day', objects: [hourOfDay, weekday, cells, scale, title6, titleHour, titleWeekday, tooltip], margin: { right: 70 } },
    { name: 'many-points', objects: [signalTime, signalValue, signalLine, title7, cursor, tooltip, signalTools] },
  ]
  // #endregion chart

  const others: { destroy(): void }[] = [requests, cpu, latency, errors, time, fitTime, signal, dSignalTime, dSignal, fitSignal, quarters, fitQuarters, sales2025, sales2026, margin, ...weather, stack, dMonth, dDays, fit, shares, prices, average, volume, dDate, dPrice, dVolume, follow, traffic, dHour, dWeekday, colors, colorFit]
  const all = [...others, yRequests, yCpu, yLatency, yErrors, hour, day, ...charts.flatMap((c) => c.objects)]
  return {
    charts,
    tooltip,
    actions,
    sizes,
    setSize,
    destroy: () => destroyAll(new Set(all)),
  }
}
export type ShowcaseScenario = ReturnType<typeof createShowcaseScenario>
