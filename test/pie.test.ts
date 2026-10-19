import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  D3PAngleAxis, D3PAxisDomain, D3PBus, D3PCartesianSystem, D3PChart, D3PInteractionArea, D3PLegendBundle, D3PLineRenderer, D3PPieRenderer,
  D3PPolarSystem, D3PRadiusAxis, D3PSeries, D3PTooltipManager, d3pSettle, d3pTooltipText, type D3PTooltipData,
} from '../src'
import { pointer, hitAt } from './helpers'

// 400x300 with the default margins: inner area 320x240; polar disc centered at (160, 120), radius 92.
const CX = 160
const CY = 120
const R = 92
const at = (deg: number, r: number): [number, number] => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)]

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

const DATA: [string, number][] = [['a', 1], ['b', 1], ['c', 2]]

function pie(data: [string, number][] = DATA, props: ConstructorParameters<typeof D3PPieRenderer>[0]['props'] = {}) {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const series = new D3PSeries({ bus, name: 'share', data })
  const renderer = new D3PPieRenderer({ bus, series, props })
  renderer.addToChart(chart)
  return { chart, series, renderer }
}

describe('pie slices', () => {
  it('draws one slice per positive value, sized by its share, with percent labels', async () => {
    const { chart, renderer } = pie([...DATA, ['zero', 0], ['negative', -3], ['nan', NaN]])
    await transitions()
    expect(el.querySelectorAll('path.slice').length).toBe(3)
    const s = renderer.slices(chart)
    expect(s.map((x) => x.label)).toEqual(['a', 'b', 'c'])
    expect(s.map((x) => x.percent)).toEqual([0.25, 0.25, 0.5])
    expect(s[0].startAngle).toBeCloseTo(0)
    expect(s[0].endAngle).toBeCloseTo(Math.PI / 2)
    expect(s[2].startAngle).toBeCloseTo(Math.PI)
    expect(s[2].endAngle).toBeCloseTo(Math.PI * 2)
    expect([...el.querySelectorAll('text.label')].map((t) => t.textContent)).toEqual(['25 %', '25 %', '50 %'])
    expect(el.querySelector('path.slice')!.getAttribute('d')).toMatch(/^M/)
    expect(el.querySelector('.series-renderer')!.getAttribute('transform')).toBe(`translate(${CX},${CY})`)
  })

  it('has no axes and needs none', async () => {
    const { chart, renderer } = pie()
    await settle()
    expect(chart.axes.getXAxes()).toEqual([])
    expect(renderer.getAxes()).toEqual({})
    expect(renderer.projectTo()).toBeUndefined()
  })

  it('takes colors from the palette, or from the colors prop', async () => {
    const { renderer, chart } = pie(DATA, { style: { colors: ['#111', '#222'] } })
    await transitions()
    expect(renderer.slices(chart).map((s) => s.color)).toEqual(['#111', '#222', '#111'])
  })

  it('sorts the slices on demand', () => {
    const { chart, renderer } = pie([['a', 1], ['b', 3], ['c', 2]], { sort: 'descending' })
    expect(renderer.slices(chart).map((s) => s.label)).toEqual(['b', 'c', 'a'])
    renderer.props({ sort: 'ascending' })
    expect(renderer.slices(chart).map((s) => s.label)).toEqual(['a', 'c', 'b'])
  })

  it('leaves out labels of small slices', async () => {
    pie([['big', 98], ['small', 2]])
    await transitions()
    expect([...el.querySelectorAll('text.label')].map((t) => t.textContent)).toEqual(['98 %'])
  })

  it('removes its slices when hidden, and redraws them when shown again', async () => {
    const { renderer } = pie()
    await transitions()
    renderer.visible = false
    await transitions()
    expect(el.querySelectorAll('path.slice').length).toBe(0)
    renderer.visible = true
    await transitions()
    expect(el.querySelectorAll('path.slice').length).toBe(3)
  })

  it('follows its data', async () => {
    const { chart, renderer, series } = pie()
    await transitions()
    series.data = [['x', 3], ['y', 1]]
    await transitions()
    expect(el.querySelectorAll('path.slice').length).toBe(2)
    expect(renderer.slices(chart).map((s) => s.percent)).toEqual([0.75, 0.25])
  })
})

describe('pie in a polar system', () => {
  it('takes its start angle, direction and hole from the system', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PPolarSystem({ bus, props: { startAngle: 90, clockwise: false, innerRadius: 0.5 } }).addToChart(chart)
    const renderer = new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: DATA }) })
    renderer.addToChart(chart)
    const [a, b, c] = renderer.slices(chart)
    expect(a.startAngle).toBeCloseTo(Math.PI / 2) // starts on the right...
    expect(a.endAngle).toBeCloseTo(0) // ...and goes counter-clockwise
    expect(b.endAngle).toBeCloseTo(-Math.PI / 2)
    expect(c.endAngle).toBeCloseTo(Math.PI / 2 - Math.PI * 2)
    // inside the hole there is nothing; between the hole and the rim, a slice
    expect(hitAt(chart, renderer, ...at(45, 20))).toBeUndefined()
    expect(hitAt(chart, renderer, ...at(45, 70))!.label).toBe('a') // up-right: the first quarter, swept from the right
    expect(hitAt(chart, renderer, ...at(315, 70))!.label).toBe('b') // up-left
  })

  it('redraws when the system changes (donut)', async () => {
    const { chart, renderer } = pie()
    await transitions()
    const full = el.querySelector('path.slice')!.getAttribute('d')
    ;(chart.coords.get('polar') as D3PPolarSystem).props({ innerRadius: 0.6 })
    await transitions()
    expect(el.querySelector('path.slice')!.getAttribute('d')).not.toBe(full)
    expect(hitAt(chart, renderer, ...at(45, 10))).toBeUndefined()
    expect(hitAt(chart, renderer, ...at(45, 70))!.label).toBe('a')
  })

  it('refuses a coordinate system that is not polar, or unknown, with an explicit error', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PCartesianSystem({ bus, name: 'plain' }).addToChart(chart)
    const series = new D3PSeries({ bus, name: 's', data: DATA })
    expect(() => new D3PPieRenderer({ bus, series, system: 'plain' }).addToChart(chart)).toThrow(/does not support the cartesian coordinate system "plain"; it needs a polar one/)
    expect(() => new D3PPieRenderer({ bus, series, system: 'nope' }).addToChart(chart)).toThrow(/renderer "s": unknown coordinate system "nope"/)
    expect(chart.renderers.getSeries()).toEqual([]) // rolled back
  })

  it('lives next to a polar chart on the same system', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(chart)
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'l', data: [[0, 10], [180, 90]] }), axes: ['angle', 'radius'] }).addToChart(chart)
    const renderer = new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'p', data: DATA }) })
    renderer.addToChart(chart)
    await transitions()
    expect(el.querySelectorAll('path.slice').length).toBe(3)
    expect(el.querySelector('path.line')).toBeTruthy()
    expect(renderer.getAxes()).toEqual({})
  })

  it('nests pies as rings', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const inner = new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'in', data: [['i1', 1], ['i2', 3]] }), props: { radius: [0, 0.5] } })
    const outer = new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'out', data: [['o1', 1], ['o2', 1]] }), props: { radius: [0.5, 1] } })
    inner.addToChart(chart)
    outer.addToChart(chart)
    expect(hitAt(chart, inner, ...at(10, 20))!.label).toBe('i1')
    expect(hitAt(chart, inner, ...at(10, 70))).toBeUndefined()
    expect(hitAt(chart, outer, ...at(10, 70))!.label).toBe('o1')
    expect(hitAt(chart, outer, ...at(10, 20))).toBeUndefined()
    expect(hitAt(chart, outer, ...at(200, 70))!.label).toBe('o2')
  })
})

describe('pie legend', () => {
  it('has one entry per slice, which shows and hides it', async () => {
    const { chart, renderer, series } = pie()
    const legend = new D3PLegendBundle({ bus })
    legend.addToChart(chart)
    await settle()
    const entries = () => legend.container.getData(chart)!.series
    expect(entries().map((e) => [e.label, e.visible])).toEqual([['a', true], ['b', true], ['c', true]])
    expect(entries().map((e) => e.color)).toEqual(renderer.slices(chart).map((s) => s.color))

    entries()[0].toggle()
    await settle()
    expect(entries().map((e) => e.visible)).toEqual([false, true, true])
    expect(renderer.slices(chart).map((s) => s.label)).toEqual(['b', 'c']) // the others take the whole circle
    expect(renderer.slices(chart).map((s) => s.percent)).toEqual([1 / 3, 2 / 3])

    entries()[0].toggle()
    await settle()
    expect(entries().every((e) => e.visible)).toBe(true)

    series.data = [['p', 1], ['q', 1]]
    await settle()
    expect(entries().map((e) => e.label)).toEqual(['p', 'q'])
  })
})

describe('pie hover and tooltip', () => {
  function withArea() {
    const out = pie()
    new D3PInteractionArea({ bus, coalesce: false }).addToChart(out.chart)
    return out
  }

  it('answers the tooltip by testing the pointer against the slices, with its share', async () => {
    const { chart } = withArea()
    let shown: D3PTooltipData | undefined
    let hidden = 0
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    bus.on(chart.event('tooltipHide'), () => void hidden++)
    new D3PTooltipManager({ bus }).addToChart(chart)
    const [x, y] = at(45, 50)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    expect(shown!.series).toHaveLength(1)
    const line = shown!.series[0]
    expect(line.label).toBe('a')
    expect(line.y).toBe(1)
    expect(line.percent).toBe(0.25)
    expect(d3pTooltipText(line)).toBe('a: 1 (25 %)')
    expect(shown!.x).toBeCloseTo(x) // the box follows the pointer
    expect(shown!.y).toBeCloseTo(y)

    const [ox, oy] = at(45, R + 30) // outside of the pie
    chart.emitEvent('mousemove', pointer(chart, ox, oy, 'mousemove'))
    await settle()
    expect(hidden).toBeGreaterThan(0)
  })

  it('does not answer for a hidden pie', async () => {
    const { chart, renderer } = withArea()
    let shown = 0
    bus.on(chart.event('tooltipShow'), () => void shown++)
    new D3PTooltipManager({ bus }).addToChart(chart)
    renderer.visible = false
    const [x, y] = at(45, 50)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    expect(shown).toBe(0)
  })

  it('moves the slice under the pointer outwards, and back', async () => {
    const { chart } = withArea()
    await transitions()
    const first = () => el.querySelector('path.slice')!.getAttribute('transform')
    expect(first()).toBe('translate(0,0)')
    const [x, y] = at(45, 50)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await transitions()
    const m = first()!.match(/translate\(([-\d.]+),([-\d.]+)\)/)!
    expect(+m[1]).toBeCloseTo(6 * Math.sin(Math.PI / 4)) // 'a' spans 0 to 90 degrees: it moves up-right
    expect(+m[2]).toBeCloseTo(-6 * Math.cos(Math.PI / 4))
    chart.emitEvent('mouseleave', pointer(chart, x, y, 'mouseleave'))
    await transitions()
    expect(first()).toBe('translate(0,0)')
  })

  it('asks for an interaction area, unless hover is off', () => {
    const asked: unknown[] = []
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    bus.on(chart.event('needInteractionArea'), (c) => void asked.push(c))
    new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'a', data: DATA }), props: { hover: false } }).addToChart(chart)
    return settle().then(() => {
      expect(asked).toHaveLength(0)
      new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'b', data: DATA }) }).addToChart(chart)
      return settle().then(() => expect(asked).toHaveLength(1))
    })
  })
})
