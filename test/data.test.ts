import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { D3PBus, D3PChart, d3pAutoInteractionArea, d3pInterpolateSeries, d3pSettle } from '../src'
import { createDataScenario } from '../examples/scenarios/data'

let bus: D3PBus
let el: HTMLElement
beforeEach(() => {
  bus = new D3PBus()
  el = document.createElement('div')
  document.body.append(el)
})
afterEach(() => (document.body.innerHTML = ''))

describe('changing the data of a series', () => {
  function chart() {
    const scenario = createDataScenario(bus)
    const c = new D3PChart({ container: el, width: 400, height: 300, bus })
    d3pAutoInteractionArea(c)
    scenario.objects.forEach((o) => o.addToChart(c))
    return { scenario, c }
  }
  const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms))

  it('draws one bar and one point of the line per row, and follows adds and removals', async () => {
    const { scenario, c } = chart()
    await d3pSettle(bus)
    await wait()
    expect(c.getSvg().querySelectorAll('rect.bar').length).toBe(8)

    scenario.actions['add a point']()
    await d3pSettle(bus)
    await wait()
    expect(c.getSvg().querySelectorAll('rect.bar').length).toBe(9)

    scenario.actions['remove the first']()
    scenario.actions['remove the last']()
    await d3pSettle(bus)
    await wait()
    expect(c.getSvg().querySelectorAll('rect.bar').length).toBe(7)
  })

  it('fits the axes to the new data', async () => {
    const { scenario, c } = chart()
    const x = c.axes.getXAxis('month')!
    await d3pSettle(bus)
    scenario.actions['remove the first']()
    scenario.actions['add a point']()
    await d3pSettle(bus)
    const [from, to] = x.domain.domain.map(Number)
    expect(from).toBe(1) // the first month is gone
    expect(to).toBe(8) // and a new one is there
  })

  it('animates even though the auto domain changes the scale in the same frame', async () => {
    const { scenario, c } = chart()
    await d3pSettle(bus)
    await wait()
    const before = [...c.getSvg().querySelectorAll('rect.bar')].map((r) => +r.getAttribute('x')!)
    scenario.actions['remove the first']() // the x domain changes: every bar moves
    await d3pSettle(bus)
    const during = [...c.getSvg().querySelectorAll('rect.bar')].map((r) => +r.getAttribute('x')!)
    await wait()
    const after = [...c.getSvg().querySelectorAll('rect.bar')].map((r) => +r.getAttribute('x')!)
    expect(Math.abs(during[3] - after[3])).toBeGreaterThan(5) // a bar in the middle is still on its way
    expect(after.length).toBe(before.length - 1)
  })

  it('keeps the bar of a value when another one goes: bars are paired by x, not by index', async () => {
    const { scenario, c } = chart()
    await d3pSettle(bus)
    await wait()
    const bars = () => [...c.getSvg().querySelectorAll('rect.bar')]
    const third = bars()[3] // the value 3
    scenario.actions['remove the first']()
    await d3pSettle(bus)
    await wait()
    expect(bars()).toContain(third)
    expect(bars().length).toBe(7)
  })

  it('has bars enter and exit instead of jumping', async () => {
    const { scenario, c } = chart()
    await d3pSettle(bus)
    await wait()
    scenario.actions['add a point']()
    await d3pSettle(bus)
    // the transition starts: the new bar exists, but is not at its full height yet
    const heights = [...c.getSvg().querySelectorAll('rect.bar')].map((r) => +r.getAttribute('height')!)
    expect(heights.length).toBe(9)
    expect(heights[8]).toBeLessThan(Math.max(...heights.slice(0, 8)))
    await wait()
    expect(+[...c.getSvg().querySelectorAll('rect.bar')][8].getAttribute('height')!).toBeGreaterThan(0)
  })
})

const placed = (points: [number, number][], keys = points.map((p) => p[0])) => ({ keys, points })

describe('the animation between two states of a line', () => {
  it('pairs the points by their x value, and animates them by their pixels', () => {
    // the points of the values 1, 2, 3; the first goes, and the scale changes: 2 and 3 are elsewhere
    const f = d3pInterpolateSeries(placed([[10, 5], [20, 6], [30, 7]], [1, 2, 3]), placed([[0, 5], [50, 7]], [2, 3]))
    expect(f.keys).toEqual([1, 2, 3])
    expect(f.interpolatedFrom).toEqual([[10, 5], [20, 6], [30, 7]])
    // the point that goes ends on its nearest neighbor; the others move from their own pixels to their own
    expect(f.interpolatedTo).toEqual([[0, 5], [0, 5], [50, 7]])
  })

  it('does not move a point that has not changed', () => {
    const f = d3pInterpolateSeries(placed([[10, 5], [20, 6], [30, 7]], [1, 2, 3]), placed([[10, 5], [20, 9], [30, 7], [40, 1]], [1, 2, 3, 4]))
    expect(f(0.5)[0]).toEqual([10, 5])
    expect(f(0.5)[2]).toEqual([30, 7])
    expect(f(0.5)[1]).toEqual([20, 7.5])
  })

  it('lets a point that is new be born on its nearest neighbor, and one that goes die on it', () => {
    const before: [number, number][] = [[0, 10], [10, 20], [20, 30]]
    const after: [number, number][] = [[0, 10], [10, 20], [15, 25], [20, 30]]
    const f = d3pInterpolateSeries(placed(before), placed(after))
    const start = f(0)
    expect(start.length).toBe(4) // as many points as the longest of the two
    expect(start[2]).toEqual([10, 20]) // the new point begins where its neighbor was (the nearest of the points before it)
    expect(f(1)).toEqual(after)
    // removal: the point that goes ends on its neighbor
    const g = d3pInterpolateSeries(placed(after), placed(before))
    expect(g(1).map((p) => p[0])).toEqual([0, 10, 10, 20])
  })

  it('grows from a baseline when there was nothing', () => {
    const f = d3pInterpolateSeries(240, placed([[0, 100], [50, 50]]))
    expect(f(0)).toEqual([[0, 240], [50, 240]])
    expect(f(1)).toEqual([[0, 100], [50, 50]])
  })
})

describe('the buttons of the showcase', () => {
  it('change the data of every chart, and the charts keep drawing', async () => {
    const { createShowcaseScenario } = await import('../examples/scenarios/showcase')
    const scenario = createShowcaseScenario(bus)
    const charts = scenario.charts.map(({ objects, margin }) => {
      const container = document.createElement('div')
      el.append(container)
      const c = new D3PChart({ container, width: 600, height: 400, bus, margin })
      d3pAutoInteractionArea(c)
      objects.forEach((o) => o.addToChart(c))
      return c
    })
    const count = (selector: string) => charts.map((c) => c.getSvg().querySelectorAll(selector).length)
    await d3pSettle(bus)
    const before = count('.bar, .slice, path.line, .candle, rect.cell')
    for (const name of Object.keys(scenario.actions)) {
      scenario.actions[name]()
      await d3pSettle(bus)
      await new Promise((r) => setTimeout(r, 260))
    }
    expect(count('.bar, .slice, path.line, .candle, rect.cell').every((n) => n > 0)).toBe(true)
    scenario.actions['add a point']()
    scenario.actions['add a point']()
    await d3pSettle(bus)
    expect(count('.bar, .slice, path.line, .candle, rect.cell')).not.toEqual(before)
    scenario.destroy()
  })
})

describe('adding points without a limit, and annotations at the edge of the plot', () => {
  it('shows every category that is added to the quarters of the showcase', async () => {
    const { createShowcaseScenario } = await import('../examples/scenarios/showcase')
    const scenario = createShowcaseScenario(bus)
    const c = new D3PChart({ container: el, width: 800, height: 400, bus })
    d3pAutoInteractionArea(c)
    scenario.charts[1].objects.forEach((o) => o.addToChart(c))
    await d3pSettle(bus)
    for (let i = 0; i < 12; i++) scenario.actions['add a point']()
    await d3pSettle(bus)
    await new Promise((r) => setTimeout(r, 260))
    expect(c.getSvg().querySelectorAll('rect.bar').length).toBe(40) // 20 quarters, two columns each
    scenario.destroy()
  })

  it('clips the marks of an annotation to the plot, and drops the label of a mark that is outside', async () => {
    const { D3PAnnotationLine, D3PAnnotationBand, D3PAxis, D3PAxisDomain } = await import('../src')
    const c = new D3PChart({ container: el, width: 400, height: 300, bus })
    const x = new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) })
    const y = new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 10] }), position: 'left' })
    const inside = new D3PAnnotationLine({ bus, axis: x, value: 5, label: 'inside' })
    const outside = new D3PAnnotationLine({ bus, axis: x, value: 50, label: 'outside' })
    const band = new D3PAnnotationBand({ bus, axis: x, from: 8, to: 14, label: 'band' })
    for (const o of [x, y, inside, outside, band]) o.addToChart(c)
    await d3pSettle(bus)
    const svg = c.getSvg()
    expect(svg.querySelectorAll('.layer-annotation g[clip-path]').length).toBeGreaterThan(0)
    const labels = [...svg.querySelectorAll('.annotation text')].map((t) => t.textContent)
    expect(labels).toContain('inside')
    expect(labels).not.toContain('outside')
    expect(svg.querySelectorAll('.annotation-line').length).toBe(1)
  })
})
