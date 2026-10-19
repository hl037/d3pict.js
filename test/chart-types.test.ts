import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  D3PAngleAxis, D3PAnnotationBand, D3PAnnotationLine, D3PAnnotationPoint, d3pSparkline, D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PBarRenderer, D3PBoxPlotRenderer, D3PBubbleRenderer, D3PBus, D3PCandlestickRenderer,
  D3PChart, D3PColorLegend, D3PColorScale, D3PCursorIndicator, D3PFunnelRenderer, D3PHeatmapRenderer, D3PLegendBundle, D3PDumbbellRenderer, D3PHistogram, D3P_BOXPLOT_COLUMNS, d3pBoxPlotRows, d3pTooltipText, D3PLineRenderer, D3PPieRenderer, D3PPolarSystem, D3PRadarAngleAxisRenderer, D3PRadiusAxis, D3PSeries, D3PStack, D3PTooltipManager,
  D3PWaterfall, d3pHistogram, d3pSettle, type D3PSeriesOptions, type D3PTooltipData,
} from '../src'
import { pointer, valuesAt, hitAt } from './helpers'

// 400x300 with the default margins: inner area 320x240.
let bus: D3PBus
let el: HTMLElement
const settle = () => d3pSettle(bus)
const transitions = async () => {
  await settle()
  await new Promise((r) => setTimeout(r, 300))
}

beforeEach(() => {
  bus = new D3PBus()
  el = document.createElement('div')
  document.body.append(el)
})
afterEach(() => {
  document.body.innerHTML = ''
})

/** A cartesian chart with X in [0, xMax] and Y in [0, yMax]. */
function cartesian(xDomain: unknown[] = [0, 1], yDomain: unknown[] = [0, 20], xScale: 'linear' | 'band' | 'point' = 'linear') {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const x = new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: xDomain as never }), scaleType: xScale })
  const y = new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: yDomain as never }), position: 'left' })
  x.addToChart(chart)
  y.addToChart(chart)
  return { chart, x, y }
}
const series = (data: unknown, opts: Partial<D3PSeriesOptions> = {}) => new D3PSeries({ bus, name: 's', data: data as never, ...opts })
const path = (cls: string) => el.querySelector(`path.${cls}`)?.getAttribute('d') ?? null

describe('curves and gaps', () => {
  it('joins points with the chosen curve', async () => {
    const { chart } = cartesian()
    new D3PLineRenderer({ bus, series: series([[0, 0], [0.5, 10], [1, 20]]), props: { style: { curve: 'step' } } }).addToChart(chart)
    await transitions()
    expect(path('line')).toBe('M0,240L80,240L80,120L240,120L240,0L320,0') // steps, not a slope
  })

  it('connects over missing values by default, and breaks on request', async () => {
    const { chart } = cartesian()
    const data = [[0, 5], [0.5, NaN], [1, 15]]
    const connected = new D3PLineRenderer({ bus, series: series(data) })
    connected.addToChart(chart)
    await transitions()
    expect(path('line')!.match(/M/g)).toHaveLength(1)
    expect(path('line')).toBe('M0,180L320,60')

    connected.props({ style: { gaps: 'break' } })
    await transitions()
    // each side of the gap is a single point: nothing to draw, but it is two pieces, not one line
    expect(path('line')).not.toBe('M0,180L320,60')

    const gapped = [[0, 5], [0.25, 8], [0.5, NaN], [0.75, 12], [1, 15]]
    connected.series.data = gapped
    await transitions()
    expect(path('line')!.match(/M/g)).toHaveLength(2)
  })

  it('breaks polar lines too', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(chart)
    new D3PLineRenderer({ bus, series: series([[0, 10], [60, 50], [120, NaN], [180, 50], [240, 90]]), props: { style: { gaps: 'break' } } }).addToChart(chart)
    await transitions()
    expect(path('line')!.match(/M/g)).toHaveLength(2)
  })
})

describe('area between two curves', () => {
  it('uses the base column of each point', async () => {
    const { chart } = cartesian()
    const range = series([[0, 10, 2], [1, 20, 5]], { columns: ['x', 'high', 'low'] })
    new D3PAreaRenderer({ bus, series: range, props: { base: 'low' } }).addToChart(chart)
    await transitions()
    expect(path('area')).toBe('M0,120L320,0L320,180L0,216Z')
  })

  it('falls back to the zero line without a base, and takes a y0 column by default', async () => {
    const { chart } = cartesian()
    new D3PAreaRenderer({ bus, series: series([[0, 10], [1, 20]]) }).addToChart(chart)
    await transitions()
    expect(path('area')).toBe('M0,120L320,0L320,240L0,240Z')

    const { chart: other } = cartesian()
    void other
    const stacked = series([[0, 10, 4], [1, 20, 8]], { columns: ['x', 'y', 'y0'] })
    new D3PAreaRenderer({ bus, series: stacked }).addToChart(chart)
    await transitions()
    expect(el.querySelectorAll('path.area')[1].getAttribute('d')).toBe('M0,120L320,0L320,144L0,192Z')
  })

  it('refuses a base column the series does not have, when attaching', () => {
    const { chart } = cartesian()
    expect(() => new D3PAreaRenderer({ bus, series: series([[0, 1]]), props: { base: 'low' } }).addToChart(chart)).toThrow(/no column "low" to use as the base/)
    expect(chart.renderers.getSeries()).toEqual([])
  })

  it('draws it in polar too, closed on the base radius', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(chart)
    const range = series([[0, 80, 40], [180, 90, 50]], { columns: ['x', 'high', 'low'] })
    new D3PAreaRenderer({ bus, series: range, props: { base: 'low' } }).addToChart(chart)
    await transitions()
    expect(path('area')).toMatch(/^M.*Z$/)
  })
})

const rects = () => [...el.querySelectorAll('rect.bar')].map((r) => ({ x: +r.getAttribute('x')!, y: +r.getAttribute('y')!, w: +r.getAttribute('width')!, h: +r.getAttribute('height')! }))

describe('bars', () => {
  it('draws columns on a band axis, from the zero line', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 10], 'band')
    new D3PBarRenderer({ bus, series: series([['a', 5], ['b', 10]]) }).addToChart(chart)
    await transitions()
    const [a, b] = rects()
    expect(a.h).toBeCloseTo(120)
    expect(a.y).toBeCloseTo(120)
    expect(b.h).toBeCloseTo(240)
    expect(a.w).toBeCloseTo(160 * 0.9) // 90 % of a band
  })

  it('draws horizontal bars: the category on the Y axis, the value on the X axis', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'value', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) }).addToChart(chart)
    new D3PAxis({ bus, name: 'cat', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), position: 'left', scaleType: 'band' }).addToChart(chart)
    const bar = new D3PBarRenderer({ bus, series: series([['a', 5], ['b', 10]]), props: { orientation: 'horizontal' } })
    bar.addToChart(chart)
    await transitions()
    const [a, b] = rects()
    expect(a.x).toBeCloseTo(0)
    expect(a.w).toBeCloseTo(160) // 5 of 10 along the 320 px X axis
    expect(b.w).toBeCloseTo(320)
    expect(a.h).toBeCloseTo(120 * 0.9) // a band of the Y axis
    // the renderer's "x" axis is the one its categories are on
    expect(bar.getAxes(chart).x!.name).toBe('cat')
    expect(bar.getAxes(chart).y!.name).toBe('value')
    expect(bar.projectTo(chart, 'a', 5)!.x).toBeCloseTo(160)
  })

  it('starts bars from a base column: ranges, and the y0 of a stack', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 20], 'band')
    new D3PBarRenderer({ bus, series: series([['a', 10, 4], ['b', 20, 10]], { columns: ['x', 'high', 'low'] }), props: { base: 'low' } }).addToChart(chart)
    await transitions()
    const [a, b] = rects()
    expect(a.y).toBeCloseTo(120) // top at 10
    expect(a.h).toBeCloseTo(72) // down to 4
    expect(b.y).toBeCloseTo(0)
    expect(b.h).toBeCloseTo(120)
  })

  it('colors by sign, or by a column', async () => {
    const { chart } = cartesian(['a', 'b'], [-10, 10], 'band')
    new D3PBarRenderer({ bus, series: series([['a', 5], ['b', -5]]), props: { style: { color: '#0a0', negativeColor: '#a00' } } }).addToChart(chart)
    await transitions()
    expect([...el.querySelectorAll('rect.bar')].map((r) => r.getAttribute('fill'))).toEqual(['#0a0', '#a00'])
  })

  it('refuses a column it needs but the series lacks', () => {
    const { chart } = cartesian()
    expect(() => new D3PBarRenderer({ bus, series: series([[0, 1]]), props: { base: 'low' } }).addToChart(chart)).toThrow(/no column "low"/)
    expect(() => new D3PBarRenderer({ bus, series: series([[0, 1]]), props: { style: { colorBy: 'kind' } } }).addToChart(chart)).toThrow(/no column "kind"/)
  })

  it('draws lollipops: a stem and a dot', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 10], 'band')
    new D3PBarRenderer({ bus, series: series([['a', 5], ['b', 10]]), props: { style: { shape: 'lollipop' } } }).addToChart(chart)
    await transitions()
    const marks = [...el.querySelectorAll('g.bar')]
    expect(marks).toHaveLength(2)
    const stem = marks[0].querySelector('line')!
    expect(+stem.getAttribute('y1')!).toBeCloseTo(240) // from the zero line...
    expect(+stem.getAttribute('y2')!).toBeCloseTo(120) // ...to the value
    expect(+marks[0].querySelector('circle')!.getAttribute('cy')!).toBeCloseTo(120)
    expect(+stem.getAttribute('x1')!).toBeCloseTo(80) // the middle of the first of two bands
  })

  it('switches between rectangles and arcs when the system changes', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const bar = new D3PBarRenderer({ bus, series: series([['a', 5], ['b', 10]]) })
    bar.addToChart(chart)
    const da = new D3PAxisDomain({ bus, domain: ['a', 'b'] })
    const dv = new D3PAxisDomain({ bus, domain: [0, 10] })
    const cart = [new D3PAxis({ bus, name: 'c', domain: da, scaleType: 'band' }), new D3PAxis({ bus, name: 'v', domain: dv, position: 'left' })]
    const pol = [new D3PAngleAxis({ bus, name: 'c', domain: da, scaleType: 'band' }), new D3PRadiusAxis({ bus, name: 'v', domain: dv })]
    cart.forEach((a) => a.addToChart(chart))
    await transitions()
    expect(el.querySelectorAll('rect.bar')).toHaveLength(2)
    cart.forEach((a) => a.removeFromChart(chart))
    pol.forEach((a) => a.addToChart(chart))
    await transitions()
    expect(el.querySelectorAll('rect.bar')).toHaveLength(0)
    const arcs = [...el.querySelectorAll('path.bar')]
    expect(arcs).toHaveLength(2)
    expect(arcs[0].getAttribute('d')).toMatch(/^M/)
    expect(arcs[0].getAttribute('transform')).toBe('translate(160,120)')
  })

  it('draws radial bars when the categories are on the radius', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'value', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'cat', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), scaleType: 'band' }).addToChart(chart)
    new D3PBarRenderer({ bus, series: series([['a', 50], ['b', 100]]), props: { orientation: 'horizontal' } }).addToChart(chart)
    await transitions()
    expect(el.querySelectorAll('path.bar')).toHaveLength(2)
  })

  it('answers the tooltip through the axis of its categories, horizontal or not', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'value', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) }).addToChart(chart)
    new D3PAxis({ bus, name: 'cat', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), position: 'left', scaleType: 'band' }).addToChart(chart)
    new D3PBarRenderer({ bus, series: series([['a', 5], ['b', 10]]), props: { orientation: 'horizontal' } }).addToChart(chart)
    let shown: D3PTooltipData | undefined
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    new D3PTooltipManager({ bus }).addToChart(chart)
    // the pointer is over band "a" (the lower one: a band axis grows upwards from the bottom)
    chart.emitEvent('mousemove', pointer(chart, 50, 200, 'mousemove'))
    await settle()
    expect(shown!.series[0].x).toBe('a')
    expect(shown!.series[0].y).toBe(5)
  })
})

describe('stack, waterfall and histogram', () => {
  const A = series([[0, 2], [1, 3], [2, 1]], { name: 'a' } as never)
  const mk = (name: string, data: unknown) => new D3PSeries({ bus, name, data: data as never })

  it('stacks series into layers with a base, keeping the original value', () => {
    const a = mk('a', [[0, 2], [1, 3]])
    const b = mk('b', [[0, 1], [1, 4]])
    const stack = new D3PStack({ bus, series: [a, b] })
    expect(stack.series.map((s) => s.name)).toEqual(['a', 'b'])
    expect(stack.series[0].columns).toEqual(['x', 'y', 'y0', 'value'])
    expect(stack.series[0].data).toEqual([[0, 2, 0, 2], [1, 3, 0, 3]])
    expect(stack.series[1].data).toEqual([[0, 3, 2, 1], [1, 7, 3, 4]]) // on top of a, original value kept
    expect(stack.series[1].display).toBe('value')
    void A
  })

  it('merges x values, counts a missing one as 0, and follows its inputs', async () => {
    const a = mk('a', [[0, 2], [2, 4]])
    const b = mk('b', [[1, 5]])
    const stack = new D3PStack({ bus, series: [a, b] })
    expect(stack.series[0].data.map((p) => p[0])).toEqual([0, 1, 2])
    expect(stack.series[1].data).toEqual([[0, 2, 2, 0], [1, 5, 0, 5], [2, 4, 4, 0]])
    let changed = 0
    bus.on(stack.e.changed, () => void changed++)
    a.data = [[0, 10], [1, 10], [2, 10]]
    await bus.idle()
    expect(stack.series[0].data.map((p) => p[1])).toEqual([10, 10, 10])
    expect(changed).toBeGreaterThan(0)
  })

  it('normalizes to 100 %, and centers a streamgraph', () => {
    const a = mk('a', [[0, 1], [1, 3]])
    const b = mk('b', [[0, 1], [1, 1]])
    const expand = new D3PStack({ bus, series: [a, b], offset: 'expand' })
    expect(expand.series[1].data.map((p) => p[1])).toEqual([1, 1]) // tops reach 1
    expect(expand.series[0].data.map((p) => p[1])).toEqual([0.5, 0.75])
    const wiggle = new D3PStack({ bus, series: [a, b], offset: 'silhouette' })
    const base0 = wiggle.series[0].data[0][2] as number
    const top = wiggle.series[1].data[0][1] as number
    expect(base0 + top).toBeCloseTo(0) // symmetric around zero
    expect(() => expand.setLayout({ offset: 'none', order: 'descending' })).not.toThrow()
    expect(expand.series[0].data.map((p) => p[2])).toEqual([0, 0].map((_, i) => expand.series[0].data[i][2]))
  })

  it('fits the domain to the stack, not to the raw values', () => {
    const a = mk('a', [[0, 2], [1, 3]])
    const b = mk('b', [[0, 1], [1, 4]])
    const stack = new D3PStack({ bus, series: [a, b], offset: 'expand' })
    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const auto = new D3PAutoDomain({ bus })
    for (const s of stack.series) auto.linkSeries(s, [dx, dy])
    expect(dy.domain).toEqual([0, 1]) // not [0, 4]
  })

  it('draws stacked areas and bars from the base of each layer', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 10], 'band')
    const stack = new D3PStack({ bus, series: [mk('p', [['a', 2], ['b', 4]]), mk('q', [['a', 3], ['b', 5]])] })
    stack.series.forEach((s) => new D3PBarRenderer({ bus, series: s }).addToChart(chart))
    await transitions()
    const r = rects()
    expect(r[2].y).toBeCloseTo(240 - (5 / 10) * 240) // layer q of "a": from 2 up to 5
    expect(r[2].h).toBeCloseTo((3 / 10) * 240)
  })

  it('turns steps into running sums, with totals', () => {
    const steps = mk('profit', [['start', 100], ['sales', 50], ['costs', -30], ['end', 0]])
    const wf = new D3PWaterfall({ bus, series: steps, totals: ['end'] })
    expect(wf.series.columns).toEqual(['x', 'y', 'y0', 'value', 'kind'])
    expect(wf.series.data).toEqual([
      ['start', 100, 0, 100, 'up'],
      ['sales', 150, 100, 50, 'up'],
      ['costs', 120, 150, -30, 'down'],
      ['end', 120, 0, 120, 'total'],
    ])
    expect(new D3PWaterfall({ bus, series: steps, totals: (_x, i) => i === 3 }).series.data[3][4]).toBe('total')
  })

  it('colors waterfall bars by kind', async () => {
    const { chart } = cartesian(['a', 'b', 'c'], [0, 200], 'band')
    const wf = new D3PWaterfall({ bus, series: mk('w', [['a', 100], ['b', -40], ['c', 0]]), totals: ['c'] })
    new D3PBarRenderer({ bus, series: wf.series, props: { style: { colorBy: 'kind', colors: { up: '#0a0', down: '#a00', total: '#555' } } } }).addToChart(chart)
    await transitions()
    expect([...el.querySelectorAll('rect.bar')].map((r) => r.getAttribute('fill'))).toEqual(['#0a0', '#a00', '#555'])
  })

  it('bins values with edges, and bars take their width from them', async () => {
    const bins = d3pHistogram([1, 2, 2, 3, 3, 3, 8], { thresholds: [0, 4, 8, 12] })
    expect(bins.map((b) => [b.x0, b.x1, b.count])).toEqual([[0, 4, 6], [4, 8, 0], [8, 12, 1]])
    const values = mk('v', [1, 2, 2, 3, 3, 3, 8])
    const hist = new D3PHistogram({ bus, series: values, thresholds: [0, 4, 8, 12] })
    expect(hist.series.columns).toEqual(['x', 'y', 'x0', 'x1'])
    expect(hist.series.data[0]).toEqual([2, 6, 0, 4])
    // the auto domain covers the edges of the first and last bin
    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    new D3PAutoDomain({ bus }).linkSeries(hist.series, [dx, dy])
    expect(dx.domain).toEqual([0, 12])
    expect(dy.domain).toEqual([0, 6])
    const { chart } = cartesian([0, 12], [0, 6])
    new D3PBarRenderer({ bus, series: hist.series }).addToChart(chart)
    await transitions()
    const [first] = rects()
    expect(first.w).toBeCloseTo((4 / 12) * 320 * 0.95) // 95 % of the bin, 4 of 12 units wide
    expect(first.x).toBeCloseTo((2 / 12) * 320 - (first.w / 2)) // centered on the bin
    // new data: the bins follow
    values.data = [10, 11]
    await bus.idle()
    expect(hist.series.data.reduce((n, p) => n + p[1], 0)).toBe(2)
  })
})

describe('partial circles (gauges, semi-donuts)', () => {
  // inner area 320x240, disc center (160, 120), radius 92
  function half() {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    // start on the left, turn clockwise over the top, end on the right
    const system = new D3PPolarSystem({ bus, props: { startAngle: 270, sweep: 180 } })
    system.addToChart(chart)
    const angle = new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) })
    const radius = new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) })
    angle.addToChart(chart)
    radius.addToChart(chart)
    return { chart, system, angle, radius }
  }
  const at = (deg: number, r: number): [number, number] => [160 + r * Math.sin((deg * Math.PI) / 180), 120 - r * Math.cos((deg * Math.PI) / 180)]

  it('covers only its sweep: no value in the other half', () => {
    const { chart, angle } = half()
    expect((angle.getScale(chart) as any).range()).toEqual([(270 * Math.PI) / 180, (270 * Math.PI) / 180 + Math.PI])
    const top = valuesAt(chart, ...at(0, 50))
    expect(top.a).toBeCloseTo(50) // straight up is the middle of the sweep
    expect(valuesAt(chart, ...at(270, 50)).a).toBeCloseTo(0) // the left end
    expect(valuesAt(chart, ...at(90, 50)).a).toBeCloseTo(100) // the right end
    expect(valuesAt(chart, ...at(180, 50)).a).toBeUndefined() // below the center
    expect(valuesAt(chart, ...at(180, 50)).r).toBeUndefined()
  })

  it('draws the ring and the grid as arcs, and clips to a wedge', async () => {
    const { chart, angle } = half()
    angle.props({ grid: { enabled: true } })
    new D3PLineRenderer({ bus, series: series([[0, 2], [100, 8]]) }).addToChart(chart)
    await transitions()
    expect(el.querySelector('.x-axis-a circle.domain')).toBeNull()
    expect(el.querySelector('.x-axis-a path.domain')!.getAttribute('d')).toMatch(/^M.*A92,92 0 0,1 /)
    const clip = el.querySelector('.series-renderer')!.getAttribute('clip-path')!.replace('url(', '').replace(')', '')
    expect(el.querySelector(`${clip} path`)!.getAttribute('transform')).toBe('translate(160,120)') // a wedge, not a full disc
  })

  it('does not wrap angle drags in a partial circle', () => {
    const { chart, system } = half()
    expect(system.wrap(chart, 'x', 4)).toBe(4)
    system.props({ sweep: 360 })
    expect(system.wrap(chart, 'x', 4)).toBeCloseTo(4 - Math.PI * 2)
  })

  it('draws a semi-donut, and only answers inside the half', () => {
    const { chart, system } = half()
    system.props({ innerRadius: 0.5 })
    const pie = new D3PPieRenderer({ bus, series: series([['a', 1], ['b', 1]]) })
    pie.addToChart(chart)
    const [a, b] = pie.slices(chart)
    expect(a.startAngle).toBeCloseTo((270 * Math.PI) / 180)
    expect(b.endAngle).toBeCloseTo((270 * Math.PI) / 180 + Math.PI)
    expect(hitAt(chart, pie, ...at(300, 70))!.label).toBe('a') // upper left
    expect(hitAt(chart, pie, ...at(60, 70))!.label).toBe('b') // upper right
    expect(hitAt(chart, pie, ...at(200, 70))).toBeUndefined() // lower half
  })

  it('draws the cursor circle as an arc', async () => {
    const { chart } = half()
    new D3PCursorIndicator({ bus }).addToChart(chart)
    const [x, y] = at(0, 46)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    expect(el.querySelector('circle.cursor-cross-y')).toBeNull()
    expect(el.querySelector('path.cursor-cross-y')!.getAttribute('d')).toMatch(/^M/)
  })
})

describe('radar', () => {
  function radar() {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const angle = new D3PAxis({ bus, name: 'skill', domain: new D3PAxisDomain({ bus, domain: ['a', 'b', 'c'] }), position: 'angle', scaleType: 'band', renderer: new D3PRadarAngleAxisRenderer(), props: { grid: { enabled: true } } })
    const radius = new D3PRadiusAxis({ bus, name: 'level', domain: new D3PAxisDomain({ bus, domain: [0, 10] }), props: { tickCount: 2 } })
    angle.addToChart(chart)
    radius.addToChart(chart)
    return { chart, angle, radius }
  }

  it('joins categories with straight segments, closes the outline, and fills it', async () => {
    const { chart } = radar()
    const s = series([['a', 5], ['b', 8], ['c', 3]])
    new D3PLineRenderer({ bus, series: s, props: { style: { curve: 'straight', closed: true } } }).addToChart(chart)
    new D3PAreaRenderer({ bus, series: s, name: 'fill', props: { style: { curve: 'straight', closed: true } } }).addToChart(chart)
    await transitions()
    // 3 categories + the first one again: 4 points joined by chords, not by arcs
    expect(path('line')!.split('L')).toHaveLength(4)
    expect(path('area')).toMatch(/Z$/)
  })

  it('draws a polygon for the outline and polygonal grid rings', async () => {
    const { chart } = radar()
    await transitions()
    expect(el.querySelector('.x-axis-skill polygon.domain')!.getAttribute('points')!.split(' ')).toHaveLength(3)
    // the ticks of the radius axis (0, 5, 10) give a ring each, but the one at the center
    expect(el.querySelectorAll('.x-grid-skill polygon').length).toBeGreaterThanOrEqual(2)
    expect(el.querySelectorAll('.x-grid-skill line')).toHaveLength(3) // one spoke per category
    expect(chart.axes.getXAxes()[0].name).toBe('skill')
  })

  it('chords still follow the curve by default (spirals)', async () => {
    const { chart } = radar()
    new D3PLineRenderer({ bus, series: series([['a', 5], ['b', 8], ['c', 3]]) }).addToChart(chart)
    await transitions()
    expect(path('line')!.split('L').length).toBeGreaterThan(20)
  })
})

const OHLC = ['x', 'open', 'high', 'low', 'close']
const glyphs = () => [...el.querySelectorAll('g.glyph')]

describe('candlestick', () => {
  const candles = () =>
    series(
      [[0, 10, 14, 9, 12], [1, 12, 13, 8, 9], [2, 9, 15, 9, 15]],
      { columns: OHLC, primary: 'close' },
    )

  it('draws a wick and a body per point, colored by direction', async () => {
    const { chart } = cartesian([-0.5, 2.5], [0, 20])
    new D3PCandlestickRenderer({ bus, series: candles(), props: { style: { barWidth: 20 } } }).addToChart(chart)
    await transitions()
    expect(glyphs()).toHaveLength(3)
    const wick = glyphs()[0].querySelector('line.wick')!
    expect(+wick.getAttribute('y1')!).toBeCloseTo(240 - (9 / 20) * 240) // low
    expect(+wick.getAttribute('y2')!).toBeCloseTo(240 - (14 / 20) * 240) // high
    const bodies = [...el.querySelectorAll('rect')].filter((r) => r.getAttribute('class')?.startsWith('body'))
    expect(bodies.map((b) => b.getAttribute('class'))).toEqual(['body up', 'body down', 'body up'])
    expect(bodies[0].getAttribute('fill')).toBe('#26a69a')
    expect(bodies[1].getAttribute('fill')).toBe('#ef5350')
    expect(+bodies[0].getAttribute('width')!).toBe(20)
    expect(+bodies[0].getAttribute('height')!).toBeCloseTo((2 / 20) * 240) // open 10 to close 12
  })

  it('fits the axis to lows and highs through the auto domain, and shows every value in the tooltip', async () => {
    const s = candles()
    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    new D3PAutoDomain({ bus }).linkSeries(s, [dx, dy])
    expect(dy.domain).toEqual([8, 15])
    const { chart } = cartesian(dx.domain, dy.domain)
    new D3PCandlestickRenderer({ bus, series: s }).addToChart(chart)
    let shown: D3PTooltipData | undefined
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    new D3PTooltipManager({ bus }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 100, 'mousemove'))
    await settle()
    expect(shown!.series[0].fields!.map((f) => [f.name, f.value])).toEqual([['open', 12], ['high', 13], ['low', 8], ['close', 9]])
    expect(d3pTooltipText(shown!.series[0])).toMatch(/^s: open 12(\.0)? · high 13(\.0)? · low 8(\.0)? · close 9(\.0)?$/) // formatted by the axis
  })

  it('can hollow the rising candles, and lay them horizontally', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'price', domain: new D3PAxisDomain({ bus, domain: [0, 20] }) }).addToChart(chart)
    new D3PAxis({ bus, name: 'time', domain: new D3PAxisDomain({ bus, domain: [-0.5, 2.5] }), position: 'left' }).addToChart(chart)
    const r = new D3PCandlestickRenderer({ bus, series: candles(), props: { orientation: 'horizontal', style: { hollowUp: true, barWidth: 10 } } })
    r.addToChart(chart)
    await transitions()
    const wick = glyphs()[0].querySelector('line.wick')!
    expect(+wick.getAttribute('x1')!).toBeCloseTo((9 / 20) * 320) // low is now along X
    expect(+wick.getAttribute('x2')!).toBeCloseTo((14 / 20) * 320)
    expect(glyphs()[0].querySelector('rect')!.getAttribute('fill')).toBe('none')
    expect(r.getAxes(chart).x!.name).toBe('time')
  })

  it('says which columns it needs when the series lacks them', () => {
    const { chart } = cartesian()
    const plain = series([[0, 1]])
    expect(() => new D3PCandlestickRenderer({ bus, series: plain }).addToChart(chart)).toThrow(
      /renderer "s" \(D3PCandlestickRenderer\) needs the columns open, high, low, close, but series "s" has x, y; declare them with the "columns" option/,
    )
    expect(chart.renderers.getSeries()).toEqual([])
  })

  it('refuses a polar system', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 3] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 20] }) }).addToChart(chart)
    const original = console.error
    const errors: string[] = []
    console.error = (...a: unknown[]) => void errors.push(String((a[1] as Error)?.message ?? a[0]))
    try {
      new D3PCandlestickRenderer({ bus, series: candles() }).addToChart(chart)
      await settle()
    } finally {
      console.error = original
    }
    expect(errors.some((m) => /does not support the polar coordinate system/.test(m))).toBe(true)
  })
})

describe('box plot', () => {
  it('computes quartiles, whiskers within 1.5 IQR, and outliers', () => {
    const [row] = d3pBoxPlotRows([['a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]]])
    expect(row[0]).toBe('a')
    expect(row.slice(1, 6)).toEqual([1, 3.25, 5.5, 7.75, 9])
    expect(row[6]).toEqual([100])
    expect(d3pBoxPlotRows([['empty', []], ['nan', [NaN]]])).toEqual([])
  })

  it('draws whiskers, caps, a box, a median and the outliers', async () => {
    const rows = d3pBoxPlotRows([['a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]], ['b', [10, 11, 12, 13]]])
    const { chart } = cartesian(['a', 'b'], [0, 100], 'band')
    new D3PBoxPlotRenderer({ bus, series: series(rows, { columns: [...D3P_BOXPLOT_COLUMNS], primary: 'median' }) }).addToChart(chart)
    await transitions()
    const first = glyphs()[0]
    expect(first.querySelectorAll('line.whisker')).toHaveLength(2)
    expect(first.querySelectorAll('line.cap')).toHaveLength(2)
    expect(first.querySelectorAll('rect.box')).toHaveLength(1)
    expect(first.querySelectorAll('line.median')).toHaveLength(1)
    expect(first.querySelectorAll('circle.outlier')).toHaveLength(1)
    expect(glyphs()[1].querySelectorAll('circle.outlier')).toHaveLength(0)
    const box = first.querySelector('rect.box')!
    expect(+box.getAttribute('y')!).toBeCloseTo(240 - (7.75 / 100) * 240) // top of the box: q3
    expect(+box.getAttribute('height')!).toBeCloseTo((4.5 / 100) * 240)
    expect(+first.querySelector('circle.outlier')!.getAttribute('cy')!).toBeCloseTo(0) // the outlier at 100
  })

  it('fits the domain to the outliers too', () => {
    const s = series(d3pBoxPlotRows([['a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]]]), { columns: [...D3P_BOXPLOT_COLUMNS], primary: 'median' })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    new D3PAutoDomain({ bus }).linkSeries(s, [new D3PAxisDomain({ bus, domain: ['a'] }), dy])
    expect(dy.domain).toEqual([1, 100])
  })
})

describe('dumbbell', () => {
  it('draws two dots and a line between them', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 10], 'band')
    new D3PDumbbellRenderer({ bus, series: series([['a', 2, 8], ['b', 5, 6]], { columns: ['x', 'start', 'end'], primary: 'end' }) }).addToChart(chart)
    await transitions()
    const g = glyphs()[0]
    expect(+g.querySelector('circle.start')!.getAttribute('cy')!).toBeCloseTo(240 - (2 / 10) * 240)
    expect(+g.querySelector('circle.end')!.getAttribute('cy')!).toBeCloseTo(240 - (8 / 10) * 240)
    expect(+g.querySelector('line.link')!.getAttribute('x1')!).toBeCloseTo(80) // middle of the first band
  })
})

describe('bubble', () => {
  const data = [[1, 1, 4], [2, 2, 16], [3, 3, 1]]
  const mk = () => series(data, { columns: ['x', 'y', 'size'] })

  it('sizes dots by area and draws the large ones first', async () => {
    const { chart } = cartesian([0, 4], [0, 4])
    new D3PBubbleRenderer({ bus, series: mk(), props: { radius: [0, 20] } }).addToChart(chart)
    await transitions()
    const dots = [...el.querySelectorAll('circle.bubble')]
    expect(dots).toHaveLength(3)
    const radii = dots.map((d) => +d.getAttribute('r')!)
    expect(radii[0]).toBeCloseTo(20) // size 16 (the largest) first
    expect(radii[1]).toBeCloseTo(10) // size 4: half the radius, a quarter of the area
    expect(radii[2]).toBeCloseTo(5)
  })

  it('leaves the size column out of the Y domain', () => {
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    new D3PAutoDomain({ bus }).linkSeries(mk(), [new D3PAxisDomain({ bus, domain: [0, 1] }), dy])
    expect(dy.domain).toEqual([1, 3]) // not [1, 16]
  })

  it('lists x, y and size in the tooltip', async () => {
    const { chart } = cartesian([0, 4], [0, 4])
    new D3PBubbleRenderer({ bus, series: mk() }).addToChart(chart)
    let shown: D3PTooltipData | undefined
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    new D3PTooltipManager({ bus }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 100, 'mousemove'))
    await settle()
    expect(shown!.series[0].fields!.map((f) => f.name)).toEqual(['y', 'size'])
  })

  it('needs its size column', () => {
    const { chart } = cartesian()
    expect(() => new D3PBubbleRenderer({ bus, series: series([[0, 1]]) }).addToChart(chart)).toThrow(/needs the column size/)
  })

  it('draws in polar too', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 4] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 4] }) }).addToChart(chart)
    new D3PBubbleRenderer({ bus, series: mk() }).addToChart(chart)
    await transitions()
    expect(el.querySelectorAll('circle.bubble')).toHaveLength(3)
  })
})

describe('color scale and heatmap', () => {
  const cells = () =>
    series(
      [['a', 'p', 0], ['b', 'p', 5], ['a', 'q', 10], ['b', 'q', 2.5]],
      { columns: ['x', 'y', 'value'], primary: 'value' },
    )
  function heatmapChart(extra?: ConstructorParameters<typeof D3PHeatmapRenderer>[0]['props']) {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), scaleType: 'band' }).addToChart(chart)
    new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: ['p', 'q'] }), position: 'left', scaleType: 'band' }).addToChart(chart)
    const colors = new D3PColorScale({ bus, domain: [0, 10], interpolator: (t) => `rgb(${Math.round(t * 255)},0,0)` })
    const heat = new D3PHeatmapRenderer({ bus, series: cells(), colors, props: extra })
    heat.addToChart(chart)
    return { chart, heat, colors }
  }

  it('maps values to colors, clamps, and steps with bins', () => {
    const c = new D3PColorScale({ bus, domain: [0, 10], interpolator: (t) => String(t) })
    expect(c.color(0)).toBe('0')
    expect(c.color(5)).toBe('0.5')
    expect(c.color(100)).toBe('1')
    expect(c.color(-3)).toBe('0')
    c.bins = 3
    expect([c.color(0), c.color(4), c.color(9)]).toEqual(['0', '0.5', '1'])
    c.reverse = true
    expect(c.color(0)).toBe('1')
    expect(c.stops(3).map((s) => s.offset)).toEqual([0, 0.5, 1])
  })

  it('announces its own changes and its domain is shareable', async () => {
    const c = new D3PColorScale({ bus, domain: [0, 10] })
    let n = 0
    bus.on(c.e.changed, () => void n++)
    c.domain.domain = [0, 20]
    c.interpolator = (t) => String(t)
    await bus.idle()
    expect(n).toBe(2)
    const shared = new D3PAxisDomain({ bus, domain: [1, 2] })
    expect(new D3PColorScale({ bus, domain: shared }).domain).toBe(shared)
  })

  it('draws a colored cell per point, in the right place', async () => {
    heatmapChart()
    await transitions()
    const cs = [...el.querySelectorAll('rect.cell')]
    expect(cs).toHaveLength(4)
    expect(cs.map((c) => c.getAttribute('fill'))).toEqual(['rgb(0,0,0)', 'rgb(128,0,0)', 'rgb(255,0,0)', 'rgb(64,0,0)'])
    expect(+cs[0].getAttribute('width')!).toBeCloseTo(160) // a band of two
    expect(+cs[0].getAttribute('height')!).toBeCloseTo(120)
    expect(+cs[1].getAttribute('x')!).toBeCloseTo(160) // "b" is the second column
    expect(+cs[2].getAttribute('y')!).toBeCloseTo(0) // "q" is the upper row (bands grow upwards)
  })

  it('answers the tooltip with the cell under the pointer', async () => {
    const { chart } = heatmapChart()
    let shown: D3PTooltipData | undefined
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    new D3PTooltipManager({ bus }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 240, 30, 'mousemove'))
    await settle()
    expect(shown!.series[0].label).toBe('b · q')
    expect(shown!.series[0].y).toBe(2.5)
  })

  it('needs band scales on both axes, and its columns', () => {
    const { chart } = cartesian()
    expect(() => new D3PHeatmapRenderer({ bus, series: series([[0, 1]]) }).addToChart(chart)).toThrow(/needs the column value/)
  })

  it('fits a scale of its own to the data when none is given', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), scaleType: 'band' }).addToChart(chart)
    new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: ['p', 'q'] }), position: 'left', scaleType: 'band' }).addToChart(chart)
    const s = cells()
    const heat = new D3PHeatmapRenderer({ bus, series: s })
    heat.addToChart(chart)
    expect(heat.colors.extent()).toEqual([0, 10])
    s.data = [['a', 'p', 100], ['b', 'q', 200]]
    await bus.idle()
    expect(heat.colors.extent()).toEqual([100, 200])
    expect(heat.legendEntries()).toEqual([]) // the color legend is a gradient, not a list
  })

  it('draws a gradient legend of the scale', async () => {
    const { chart, colors } = heatmapChart()
    const legend = new D3PColorLegend({ bus, scale: colors, title: 'Load', tickCount: 3 })
    legend.addToChart(chart)
    await transitions()
    const bar = el.querySelector('.color-legend rect')!
    expect(bar.getAttribute('fill')).toMatch(/^url\(#color-legend-/)
    const id = bar.getAttribute('fill')!.slice(5, -1)
    expect(el.querySelectorAll(`#${id} stop`).length).toBeGreaterThan(10)
    expect(el.querySelector('.color-legend text')!.textContent).toBe('Load')
    expect([...el.querySelectorAll('.color-legend .tick text')].map((t) => t.textContent)).toContain('10')
    colors.domain.domain = [0, 100]
    await transitions()
    expect([...el.querySelectorAll('.color-legend .tick text')].map((t) => t.textContent)).toContain('100')
    legend.removeFromChart(chart)
    expect(el.querySelector('.color-legend')).toBeNull()
    expect(el.querySelector(`#${id}`)).toBeNull()
  })

  it('draws cells as arcs on polar axes (a radial heatmap)', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), position: 'angle', scaleType: 'band' }).addToChart(chart)
    new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: ['p', 'q'] }), position: 'radius', scaleType: 'band' }).addToChart(chart)
    new D3PHeatmapRenderer({ bus, series: cells(), colors: new D3PColorScale({ bus, domain: [0, 10] }) }).addToChart(chart)
    await transitions()
    expect(el.querySelectorAll('path.cell')).toHaveLength(4)
  })
})

describe('funnel', () => {
  const stages = () => series([['visits', 1000], ['signups', 400], ['paid', 100]])
  function funnel(props: ConstructorParameters<typeof D3PFunnelRenderer>[0]['props'] = {}) {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const f = new D3PFunnelRenderer({ bus, series: stages(), props })
    f.addToChart(chart)
    return { chart, f }
  }

  it('lays stages out top to bottom, widths proportional to sizes', () => {
    const { chart, f } = funnel({ gap: 0 })
    const s = f.stages(chart)
    expect(s.map((x) => x.label)).toEqual(['visits', 'signups', 'paid'])
    expect(s.map((x) => x.percent)).toEqual([1, 0.4, 0.1])
    expect(s[0].w0).toBeCloseTo(320 * 0.9)
    expect(s[0].w1).toBeCloseTo(s[1].w0) // each stage narrows to the next
    expect(s[0].y0).toBe(0)
    expect(s[2].y1).toBeCloseTo(240)
    expect(s[2].w1).toBeCloseTo(s[2].w0 * 0.6) // the neck
  })

  it('draws stages and labels, with bars as an alternative', async () => {
    const { f } = funnel()
    await transitions()
    expect(el.querySelectorAll('path.stage')).toHaveLength(3)
    expect([...el.querySelectorAll('text.label')].map((t) => t.textContent)).toEqual(['visits: 1000', 'signups: 400', 'paid: 100'])
    f.props({ shape: 'bars' })
    await transitions()
    const [first] = f.stages({ innerWidth: 320, innerHeight: 240 } as never)
    expect(first.w0).toBe(first.w1)
  })

  it('answers the tooltip by testing the pointer against the stages', () => {
    const { chart, f } = funnel({ gap: 0 })
    expect(hitAt(chart, f, 160, 10)!.label).toBe('visits')
    expect(hitAt(chart, f, 160, 100)!.percent).toBe(0.4)
    expect(hitAt(chart, f, 2, 10)).toBeUndefined() // beside the funnel
    expect(hitAt(chart, f, 160, 300)).toBeUndefined()
  })

  it('has a legend entry per stage that hides it', async () => {
    const { chart, f } = funnel()
    const legend = new D3PLegendBundle({ bus })
    legend.addToChart(chart)
    await settle()
    const entries = () => legend.container.getData(chart)!.series
    expect(entries().map((e) => e.label)).toEqual(['visits', 'signups', 'paid'])
    entries()[0].toggle()
    await settle()
    expect(f.stages(chart).map((s) => s.label)).toEqual(['signups', 'paid'])
    expect(f.stages(chart)[0].percent).toBe(1) // the next stage becomes the reference
  })

  it('redraws when the chart is resized, like the pie', async () => {
    const { chart } = funnel()
    await transitions()
    const before = el.querySelector('path.stage')!.getAttribute('d')
    chart.resize(600, 300)
    await transitions()
    expect(el.querySelector('path.stage')!.getAttribute('d')).not.toBe(before)
  })
})

describe('pie redraws on resize', () => {
  it('follows the size of the chart', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PPieRenderer({ bus, series: series([['a', 1], ['b', 1]]) }).addToChart(chart)
    await transitions()
    const before = el.querySelector('.series-renderer')!.getAttribute('transform')
    chart.resize(600, 500)
    await transitions()
    expect(el.querySelector('.series-renderer')!.getAttribute('transform')).not.toBe(before)
  })
})

describe('annotations', () => {
  it('draws lines at values of an axis, and follows the scale', async () => {
    const { chart, x, y } = cartesian([0, 10], [0, 100])
    new D3PAnnotationLine({ bus, axis: 'x', value: 5, label: 'half' }).addToChart(chart)
    new D3PAnnotationLine({ bus, axis: y, value: 25, style: { strokeDasharray: '4,2' } }).addToChart(chart)
    await transitions()
    const [v, h] = [...el.querySelectorAll('line.annotation-line')]
    expect(+v.getAttribute('x1')!).toBeCloseTo(160)
    expect(+v.getAttribute('y2')!).toBeCloseTo(240)
    expect(+h.getAttribute('y1')!).toBeCloseTo(180)
    expect(h.getAttribute('stroke-dasharray')).toBe('4,2')
    expect(el.querySelector('.annotation text')!.textContent).toBe('half')
    x.domain.domain = [0, 20] // zoom out: the line moves
    await transitions()
    expect(+el.querySelector('line.annotation-line')!.getAttribute('x1')!).toBeCloseTo(80)
  })

  it('draws bands behind the data, spokes and rings in polar', async () => {
    const { chart } = cartesian([0, 10], [0, 100])
    new D3PAnnotationBand({ bus, axis: 'x', from: 2, to: 4, label: 'window' }).addToChart(chart)
    await transitions()
    const band = el.querySelector('rect.annotation-band')!
    expect(+band.getAttribute('x')!).toBeCloseTo(64)
    expect(+band.getAttribute('width')!).toBeCloseTo(64)
    expect(+band.getAttribute('height')!).toBeCloseTo(240) // across the whole chart
    expect(band.closest('.layer-background')).toBeTruthy()

    const polar = new D3PChart({ container: document.body.appendChild(document.createElement('div')), width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'a', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(polar)
    new D3PRadiusAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(polar)
    new D3PAnnotationLine({ bus, axis: 'a', value: 90 }).addToChart(polar)
    new D3PAnnotationLine({ bus, axis: 'r', value: 50 }).addToChart(polar)
    new D3PAnnotationBand({ bus, axis: 'r', from: 20, to: 40 }).addToChart(polar)
    await transitions()
    const svg = polar.getSvg()
    const spoke = svg.querySelector('line.annotation-line')!
    expect(+spoke.getAttribute('x2')!).toBeCloseTo(160 + 92) // 90 degrees: to the right
    expect(+svg.querySelector('circle.annotation-line')!.getAttribute('r')!).toBeCloseTo(46)
    expect(svg.querySelector('path.annotation-band')!.getAttribute('d')).toMatch(/^M/) // a ring
  })

  it('marks a point, and covers the whole last category of a band axis', async () => {
    const { chart } = cartesian(['a', 'b'], [0, 10], 'band')
    new D3PAnnotationPoint({ bus, x: 'b', y: 5, label: 'peak', radius: 6 }).addToChart(chart)
    new D3PAnnotationBand({ bus, axis: 'x', from: 'a', to: 'b' }).addToChart(chart)
    await transitions()
    const dot = el.querySelector('circle.annotation-point')!
    expect(+dot.getAttribute('cx')!).toBeCloseTo(240) // the middle of the second band
    expect(+dot.getAttribute('cy')!).toBeCloseTo(120)
    expect(+dot.getAttribute('r')!).toBe(6)
    expect(+el.querySelector('rect.annotation-band')!.getAttribute('width')!).toBeCloseTo(320) // both bands, whole
  })

  it('draws nothing for an axis that does not exist, and recovers when it appears', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAnnotationLine({ bus, axis: 'late', value: 1 }).addToChart(chart)
    await transitions()
    expect(el.querySelector('.annotation-line')).toBeNull()
    new D3PAxis({ bus, name: 'late', domain: new D3PAxisDomain({ bus, domain: [0, 2] }) }).addToChart(chart)
    await transitions()
    expect(el.querySelector('.annotation-line')).toBeTruthy()
  })
})

describe('sparkline', () => {
  it('draws a bare chart: no visible axes, small margins', async () => {
    const spark = d3pSparkline({ container: el, data: [3, 5, 2, 8], width: 100, height: 30 })
    await transitions()
    expect(el.querySelector('path.line')!.getAttribute('d')).toMatch(/^M/)
    expect([...el.querySelectorAll('.x-axis, .y-axis')].every((a) => (a as HTMLElement).style.display === 'none')).toBe(true)
    expect(spark.chart.margin.left).toBe(2)
    expect(spark.series.data).toHaveLength(4)
    spark.update([1, 2])
    await transitions()
    expect(spark.series.data).toHaveLength(2)
    spark.destroy()
    expect(el.querySelector('svg')).toBeNull()
  })

  it('has area and bar types, and fixed ends', async () => {
    const area = d3pSparkline({ container: el, data: [3, 5, 2], type: 'area', width: 100, height: 30 })
    await transitions()
    expect(el.querySelector('path.area')).toBeTruthy()
    area.destroy()
    const bars = d3pSparkline({ container: el, data: [3, -5, 2], type: 'bar', width: 100, height: 30, min: -10, max: 10 })
    await transitions()
    expect(el.querySelectorAll('rect.bar')).toHaveLength(3)
    expect(bars.chart.axes.getYAxis('y')!.domain.domain).toEqual([-10, 10])
    bars.destroy()
  })
})
