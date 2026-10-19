import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  D3PAngleAxis, D3PAngleAxisRenderer, D3PAreaRenderer, D3PAxis, D3PAxisDomain, D3PBus, D3PCartesianAxisRenderer, D3PChart,
  D3PCartesianSystem, D3PCursorIndicator, D3PCursorRadiusAxisRenderer, D3PInteractionArea, D3PLineRenderer, D3PPanTool, D3PPolarSystem, D3PRadiusAxis,
  D3PRadiusAxisRenderer, D3PScatterRenderer, D3PSeries, D3PTooltipManager, D3PWheelZoomTool, D3PZoomSelectionTool, d3pSettle,
  type D3PTooltipData,
  D3PWheelEvent,
} from '../src'
import { pointer, valuesAt } from './helpers'

// Default margins (top 20, right 20, bottom 40, left 60) on 400x300: inner area 320x240.
// Polar disc: center (160, 120), outer radius min(320, 240) / 2 - 28 = 92.
const CX = 160
const CY = 120
const R = 92

let bus: D3PBus
let el: HTMLElement
const settle = () => d3pSettle(bus)
/** Wait for the 200 ms transitions to finish. */
const transitions = async () => {
  await settle()
  await new Promise((r) => setTimeout(r, 300))
}
const fire = (target: EventTarget, type: string, x: number, y: number, extra: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, buttons: 1, ...extra }))
/** Pixel of the disc at screen angle `deg` (0 = up, clockwise) and distance `r`. */
const at = (deg: number, r: number): [number, number] => [CX + r * Math.sin((deg * Math.PI) / 180), CY - r * Math.cos((deg * Math.PI) / 180)]

beforeEach(() => {
  bus = new D3PBus()
  el = document.createElement('div')
  document.body.append(el)
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function polar() {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const da = new D3PAxisDomain({ bus, domain: [0, 360] })
  const dr = new D3PAxisDomain({ bus, domain: [0, 100] })
  const angle = new D3PAngleAxis({ bus, name: 'angle', domain: da })
  const radius = new D3PRadiusAxis({ bus, name: 'radius', domain: dr })
  const series = new D3PSeries({ bus, name: 's', data: [[0, 20], [90, 60], [180, 100], [270, 60]] })
  const line = new D3PLineRenderer({ bus, series })
  for (const o of [angle, radius, line]) o.addToChart(chart)
  new D3PInteractionArea({ bus, coalesce: false }).addToChart(chart)
  return { chart, da, dr, angle, radius, series, line }
}

describe('axis renderers', () => {
  it('refuses an axis position it does not support, with an explicit message', () => {
    const domain = new D3PAxisDomain({ bus, domain: [0, 1] })
    expect(() => new D3PAxis({ bus, name: 'r', domain, position: 'radius', renderer: new D3PCartesianAxisRenderer() })).toThrow(
      /axis "r" \(position "radius"\) is not supported by the axis renderer D3PCartesianAxisRenderer; it supports: bottom, top, left, right/,
    )
    expect(() => new D3PAxis({ bus, name: 'a', domain, position: 'bottom', renderer: new D3PAngleAxisRenderer() })).toThrow(/does not|not supported/)
    expect(() => new D3PAxis({ bus, name: 'b', domain, position: 'angle', renderer: new D3PRadiusAxisRenderer() })).toThrow(/supports: radius/)
  })

  it('serves one axis per renderer instance', () => {
    const domain = new D3PAxisDomain({ bus, domain: [0, 1] })
    const renderer = new D3PRadiusAxisRenderer()
    new D3PRadiusAxis({ bus, name: 'r1', domain, renderer })
    expect(() => new D3PRadiusAxis({ bus, name: 'r2', domain, renderer })).toThrow(/already used by axis "r1"/)
  })

  it('refuses a coordinate system of the wrong kind when attached', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PCartesianSystem({ bus, name: 'plain' }).addToChart(chart)
    const domain = new D3PAxisDomain({ bus, domain: [0, 1] })
    const axis = new D3PAngleAxis({ bus, name: 'a', domain, system: 'plain' })
    expect(() => axis.addToChart(chart)).toThrow(/cartesian system "plain".*D3PAngleAxisRenderer does not support/)
    expect(chart.axes.getXAxes()).toEqual([]) // rolled back
  })

  it('names the registered systems when an axis asks for an unknown one', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const domain = new D3PAxisDomain({ bus, domain: [0, 1] })
    const axis = new D3PAxis({ bus, name: 'x', domain, system: 'nope' })
    expect(() => axis.addToChart(chart)).toThrow(/unknown coordinate system "nope"/)
  })
})

describe('polar system', () => {
  it('creates the default polar system on demand, and scales ranges in radians and pixels', () => {
    const { chart, angle, radius } = polar()
    expect(chart.coords.list().map((s) => s.name)).toEqual(['polar'])
    expect((angle.getScale(chart) as any).range()).toEqual([0, Math.PI * 2])
    expect((radius.getScale(chart) as any).range()).toEqual([0, R])
    expect(angle.component).toBe('x')
    expect(radius.component).toBe('y')
  })

  it('draws the ring, the spoke and a line that follows the curve (densified)', async () => {
    const { series } = polar()
    await transitions()
    expect(el.querySelector('.x-axis-angle circle.domain')!.getAttribute('r')).toBe(String(R))
    expect(el.querySelectorAll('.x-axis-angle .tick').length).toBeGreaterThan(3)
    expect(el.querySelector('.y-axis-radius line.domain')).toBeTruthy()
    const d = el.querySelector('path.line')!.getAttribute('d')!
    expect(d.startsWith('M')).toBe(true)
    // 4 data points, but the segments are subdivided so the curve is round
    expect(d.split('L').length).toBeGreaterThan(series.data.length * 10)
  })

  it('draws polar areas closed on the inner radius and scatter points at their polar positions', async () => {
    const { chart, series } = polar()
    new D3PAreaRenderer({ bus, series, name: 'area' }).addToChart(chart)
    new D3PScatterRenderer({ bus, series, name: 'pts' }).addToChart(chart)
    await transitions()
    expect(el.querySelector('path.area')!.getAttribute('d')).toMatch(/Z$/)
    const c = el.querySelectorAll('circle.point')
    expect(c.length).toBe(4)
    // [0, 20] is straight up from the center: radius 20 % of R
    expect(+c[0].getAttribute('cx')!).toBeCloseTo(CX)
    expect(+c[0].getAttribute('cy')!).toBeCloseTo(CY - 0.2 * R)
    // [90, 60] is to the right
    expect(+c[1].getAttribute('cx')!).toBeCloseTo(CX + 0.6 * R)
    expect(+c[1].getAttribute('cy')!).toBeCloseTo(CY)
  })

  it('maps the pointer to values, and to nothing outside of the disc', () => {
    const { chart } = polar()
    const [x, y] = at(90, 46) // right of the center, half way
    const m = valuesAt(chart, x, y)
    expect(m.angle).toBeCloseTo(90)
    expect(m.radius).toBeCloseTo(50)
    const beyond = valuesAt(chart, ...at(10, R + 20)) // in the band of the angle labels: the angle, at the outer radius
    expect(beyond.angle).toBeCloseTo(10)
    expect(beyond.radius).toBeCloseTo(100)
    const out = valuesAt(chart, ...at(10, R + 130)) // beyond the reach of the system
    expect(out.angle).toBeUndefined()
    expect(out.radius).toBeUndefined()
    expect('angle' in out).toBe(true) // present, but without a value
  })

  it('honors the start angle, the direction and the inner radius', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const sys = new D3PPolarSystem({ bus, name: 'polar', props: { startAngle: 90, clockwise: false, innerRadius: 0.5 } })
    sys.addToChart(chart)
    const da = new D3PAxisDomain({ bus, domain: [0, 360] })
    const dr = new D3PAxisDomain({ bus, domain: [0, 100] })
    const angle = new D3PAngleAxis({ bus, name: 'angle', domain: da })
    const radius = new D3PRadiusAxis({ bus, name: 'radius', domain: dr })
    angle.addToChart(chart)
    radius.addToChart(chart)
    // angle 0 is on the right, and values grow counter-clockwise: 90 is up
    const m = valuesAt(chart, ...at(0 + 90, 60))
    expect(m.angle).toBeCloseTo(0)
    expect(valuesAt(chart, ...at(0, 60)).angle).toBeCloseTo(90)
    expect(valuesAt(chart, ...at(0, 20)).radius).toBeUndefined() // inside the hole (inner radius 46 px)
    expect((radius.getScale(chart) as any).range()).toEqual([R * 0.5, R])
  })

  it('rebuilds the scales when the system changes', async () => {
    const { chart, radius } = polar()
    const sys = chart.coords.get('polar') as D3PPolarSystem
    sys.props({ innerRadius: 0.25 })
    await settle()
    expect((radius.getScale(chart) as any).range()).toEqual([R * 0.25, R])
  })
})

describe('outside of the domain, nothing is drawn', () => {
  it('cuts the line at the angle range instead of wrapping it around the circle', async () => {
    const { chart, da, series } = polar()
    series.data = [[0, 50], [180, 50]]
    da.domain = [0, 90] // a quarter of the data fills the whole circle
    await transitions()
    const d = el.querySelector('path.line')!.getAttribute('d')!
    expect(d.split('M').length).toBe(2) // one run
    const last = d.split('L').pop()!.split(',').map(Number)
    expect(last[0]).toBeCloseTo(CX) // domain value 90 is a full turn: back at the top...
    expect(last[1]).toBeCloseTo(CY - 0.5 * R) // ...at the radius reached there (50 %)
    series.data = [[100, 50], [200, 50]] // entirely outside the domain
    await transitions()
    expect(el.querySelector('path.line')!.getAttribute('d') ?? '').toBe('')
    void chart
  })

  it('does not draw scatter points outside the domain', async () => {
    const { chart, da, series } = polar()
    new D3PScatterRenderer({ bus, series, name: 'pts' }).addToChart(chart)
    da.domain = [0, 120] // keeps 0 and 90 only
    await transitions()
    expect(el.querySelectorAll('circle.point').length).toBe(2)
  })

  it('clips polar renderers to the ring, and cartesian ones to nothing but the chart', async () => {
    const { chart } = polar()
    await settle()
    const clip = el.querySelector('.series-renderer')!.getAttribute('clip-path')!
    expect(clip).toMatch(/^url\(#polar-clip-/)
    const path = el.querySelector(`${clip.replace('url(', '').replace(')', '')} path`)!
    expect(path.getAttribute('d')).toContain(`a${R},${R}`)
    const cart = new D3PChart({ container: document.body.appendChild(document.createElement('div')), width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: [0, 1] }) }).addToChart(cart)
    new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'left' }).addToChart(cart)
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'c', data: [[0, 0], [1, 1]] }) }).addToChart(cart)
    await settle()
    expect(cart.getSvg().querySelector('.series-renderer')!.hasAttribute('clip-path')).toBe(false)
    void chart
  })
})

describe('cartesian <-> polar by changing the axes only', () => {
  it('keeps the same renderer, series and tools', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const da = new D3PAxisDomain({ bus, domain: [0, 360] })
    const dr = new D3PAxisDomain({ bus, domain: [0, 100] })
    const cart = [new D3PAxis({ bus, name: 'angle', domain: da, position: 'bottom' }), new D3PAxis({ bus, name: 'radius', domain: dr, position: 'left' })]
    const pol = [new D3PAxis({ bus, name: 'angle', domain: da, position: 'angle' }), new D3PAxis({ bus, name: 'radius', domain: dr, position: 'radius' })]
    const line = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [180, 100]] }) })
    line.addToChart(chart)
    cart.forEach((a) => a.addToChart(chart))
    await transitions()
    const cartesianPath = el.querySelector('path.line')!.getAttribute('d')
    expect(cartesianPath).toBe('M0,240L160,0') // straight segment in pixels

    cart.forEach((a) => a.removeFromChart(chart))
    pol.forEach((a) => a.addToChart(chart))
    await transitions()
    const polarPath = el.querySelector('path.line')!.getAttribute('d')
    expect(polarPath).not.toBe(cartesianPath)
    expect(polarPath!.split('L').length).toBeGreaterThan(20) // a half turn of spiral, not a chord
    expect(chart.coords.list().map((s) => s.name).sort()).toEqual(['cartesian', 'polar'])

    pol.forEach((a) => a.removeFromChart(chart))
    cart.forEach((a) => a.addToChart(chart))
    await transitions()
    expect(el.querySelector('path.line')!.getAttribute('d')).toBe(cartesianPath)
  })

  it('says so when a renderer cannot draw in the system of its axes', async () => {
    class CartesianOnly extends D3PLineRenderer {
      protected override readonly systemKinds = ['cartesian'] as const
    }
    const { chart, series } = polar()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    new CartesianOnly({ bus, series, name: 'flat' }).addToChart(chart)
    await settle()
    const messages = error.mock.calls.map((c) => String((c[1] as Error)?.message ?? c[0]))
    expect(messages.some((m) => /renderer "flat" \(CartesianOnly\) does not support the polar coordinate system "polar".*supports: cartesian/.test(m))).toBe(true)
  })

  it('refuses a renderer whose X and Y axes live in different systems', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const domain = (d: [number, number]) => new D3PAxisDomain({ bus, domain: d })
    new D3PAxis({ bus, name: 'x', domain: domain([0, 1]), position: 'bottom' }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'r', domain: domain([0, 1]) }).addToChart(chart)
    const line = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0]] }) })
    expect(() => line.getAxes(chart)).toThrow(/X axis "x" is on system "cartesian" but the Y axes \("r" on "polar"\)/)
    // picking the axes (or the system) makes it unambiguous
    new D3PAngleAxis({ bus, name: 'a', domain: domain([0, 1]) }).addToChart(chart)
    const polarLine = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 't', data: [[0, 0]] }), system: 'polar' })
    expect(polarLine.getAxes(chart).x?.name).toBe('a')
    expect(polarLine.getAxes(chart).y?.name).toBe('r')
  })
})

describe('axis that follows the cursor', () => {
  it('turns its spoke towards the pointer and stays there (or goes back)', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const da = new D3PAxisDomain({ bus, domain: [0, 360] })
    const dr = new D3PAxisDomain({ bus, domain: [0, 100] })
    new D3PAngleAxis({ bus, name: 'angle', domain: da }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'radius', domain: dr, renderer: new D3PCursorRadiusAxisRenderer({ onLeave: 0 }) }).addToChart(chart)
    const spoke = () => {
      const l = el.querySelector('.y-axis-radius line.domain')!
      return { x2: +l.getAttribute('x2')!, y2: +l.getAttribute('y2')! }
    }
    await settle()
    expect(spoke().x2).toBeCloseTo(CX) // idle: pointing up
    const [x, y] = at(90, 50)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    expect(spoke().x2).toBeCloseTo(CX + R)
    expect(spoke().y2).toBeCloseTo(CY)
    chart.emitEvent('mouseleave', pointer(chart, x, y, 'mouseleave'))
    await settle()
    expect(spoke().x2).toBeCloseTo(CX)
    expect(el.querySelector('rect.interaction-area')).toBeNull() // asked for, but nobody answered
  })

  it('snaps the angle when asked to', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAngleAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(chart)
    new D3PRadiusAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), renderer: new D3PCursorRadiusAxisRenderer({ snap: 45 }) }).addToChart(chart)
    const [x, y] = at(80, 50) // rounds to 90
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    const l = el.querySelector('.y-axis-radius line.domain')!
    expect(+l.getAttribute('x2')!).toBeCloseTo(CX + R)
  })
})

describe('tools on polar axes', () => {
  it('pans the angle by the short way and zooms the radius around the pointer', async () => {
    const { chart, da, dr } = polar()
    const pan = new D3PPanTool({ bus, axes: ['angle'] })
    pan.addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', ...at(0, 50))
    await settle()
    fire(document, 'mousemove', ...at(90, 50)) // a quarter turn clockwise
    await settle()
    expect(da.domain[0]).toBeCloseTo(-90)
    expect(da.domain[1]).toBeCloseTo(270)
    // crossing the seam does not make the domain jump by a full turn
    fire(document, 'mousemove', ...at(-90 + 360, 50))
    await settle()
    expect(da.domain[0]).toBeCloseTo(90)
    fire(document, 'mouseup', ...at(270, 50), { buttons: 0 })
    await settle()

    const zoom = new D3PWheelZoomTool({ bus, axes: ['radius'] })
    zoom.addToChart(chart)
    chart.emitEvent('wheel', new D3PWheelEvent(chart, CX, CY - R / 2, new WheelEvent('wheel', { deltaY: -1 })))
    await settle()
    // zoomed in around radius 50: the visible span shrinks by 1 / 1.1 and stays centered on 50
    expect(Number(dr.domain[1]) - Number(dr.domain[0])).toBeCloseTo(100 / 1.1)
    expect((Number(dr.domain[0]) + Number(dr.domain[1])) / 2).toBeCloseTo(50)
  })

  it('draws the zoom selection as an annular sector and zooms both axes to it', async () => {
    const { chart, da, dr } = polar()
    new D3PZoomSelectionTool({ bus }).addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', ...at(0, 23))
    await settle()
    fire(document, 'mousemove', ...at(90, 69))
    await settle()
    const shape = el.querySelector('.zoom-selection')!
    expect(shape.tagName.toLowerCase()).toBe('path')
    expect(shape.getAttribute('transform')).toBe(`translate(${CX},${CY})`)
    fire(document, 'mouseup', ...at(90, 69), { buttons: 0 })
    await settle()
    expect(da.domain[0]).toBeCloseTo(0)
    expect(da.domain[1]).toBeCloseTo(90)
    expect(dr.domain[0]).toBeCloseTo(25)
    expect(dr.domain[1]).toBeCloseTo(75)
  })
})

describe('cursor in polar', () => {
  it('draws a spoke and a circle at the pointer, with labels', async () => {
    const { chart } = polar()
    const cursor = new D3PCursorIndicator({ bus })
    cursor.addToChart(chart)
    const [x, y] = at(90, 46)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    const spoke = el.querySelector('line.cursor-cross-x')!
    expect(+spoke.getAttribute('x2')!).toBeCloseTo(CX + R)
    const circle = el.querySelector('circle.cursor-cross-y')!
    expect(+circle.getAttribute('r')!).toBeCloseTo(46)
    expect(el.querySelectorAll('.cursor-labels text').length).toBe(2)
  })
})

describe('joins and the tooltip', () => {
  /** A cartesian time axis and a polar chart whose angle is the same time, in degrees. */
  function mixed(opts: { sharedDomain?: boolean } = {}) {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const time = new D3PAxisDomain({ bus, domain: [0, 100] })
    const deg = opts.sharedDomain ? time : new D3PAxisDomain({ bus, domain: [0, 360] })
    const value = new D3PAxisDomain({ bus, domain: [0, 100] })
    const radius = new D3PAxisDomain({ bus, domain: [0, 100] })
    const axes = {
      time: new D3PAxis({ bus, name: 'time', domain: time, position: 'bottom' }),
      value: new D3PAxis({ bus, name: 'value', domain: value, position: 'left' }),
      angle: new D3PAngleAxis({ bus, name: 'angle', domain: deg }),
      radius: new D3PRadiusAxis({ bus, name: 'radius', domain: radius }),
    }
    Object.values(axes).forEach((a) => a.addToChart(chart))
    const linear = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'linear', data: [[0, 10], [50, 50], [100, 90]] }), axes: ['time', 'value'] })
    const rose = new D3PLineRenderer({
      bus,
      series: new D3PSeries({ bus, name: 'rose', data: opts.sharedDomain ? [[0, 5], [50, 40], [100, 80]] : [[0, 5], [180, 40], [360, 80]] }),
      axes: ['angle', 'radius'],
    })
    linear.addToChart(chart)
    rose.addToChart(chart)
    return { chart, axes, linear, rose }
  }

  async function hover(chart: D3PChart, tooltip: D3PTooltipManager, x: number, y: number): Promise<D3PTooltipData | undefined> {
    let shown: D3PTooltipData | undefined
    bus.on(chart.event('tooltipShow'), (d) => void (shown = d))
    tooltip.addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    return shown
  }

  it('without a join, only the system under the pointer answers', async () => {
    const { chart } = mixed()
    // over the cartesian time axis, but outside the disc and (no reach) of the polar system
    ;(chart.coords.get('polar') as D3PPolarSystem).props({ reach: 0 })
    const shown = await hover(chart, new D3PTooltipManager({ bus }), 5, 200)
    expect(shown!.series.map((s) => s.renderer.name)).toEqual(['linear'])
  })

  it('follows a join declared on the chart, converting the value', async () => {
    const { chart } = mixed()
    chart.coords.join({ axes: ['time', 'angle'], convert: (v) => (v as number) * 3.6 })
    const shown = await hover(chart, new D3PTooltipManager({ bus }), 160, 200)
    expect(shown!.series.map((s) => s.renderer.name).sort()).toEqual(['linear', 'rose'])
    const rose = shown!.series.find((s) => s.renderer.name === 'rose')!
    expect(rose.x).toBe(180) // time 50 -> 180 degrees
    expect(rose.y).toBe(40)
  })

  it('also takes joins given to the tooltip itself', async () => {
    const { chart } = mixed()
    const tip = new D3PTooltipManager({ bus, joins: [{ axes: ['angle', 'time'], convert: (v, from) => (from === 'time' ? (v as number) * 3.6 : (v as number) / 3.6) }] })
    const shown = await hover(chart, tip, 160, 200)
    expect(shown!.series.map((s) => s.renderer.name).sort()).toEqual(['linear', 'rose'])
  })

  it('anchors the box on the pointer for polar data, and on the data point where the pointer is not', async () => {
    const { chart } = mixed()
    chart.coords.join({ axes: ['time', 'angle'], convert: (v) => (v as number) * 3.6 })
    const [x, y] = at(30, 60) // inside the disc, nowhere near the data point (180 degrees, 40 %)
    const followed = await hover(chart, new D3PTooltipManager({ bus, series: ['rose'] }), x, y)
    expect(followed!.x).toBeCloseTo(x)
    expect(followed!.y).toBeCloseTo(y)

    // a second chart sharing the angle: the pointer is not over it, so its box sits on the data point
    const other = new D3PChart({ container: document.body.appendChild(document.createElement('div')), width: 400, height: 300, bus })
    const sys = new D3PPolarSystem({ bus })
    sys.addToChart(other)
    new D3PAngleAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) }).addToChart(other)
    new D3PRadiusAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) }).addToChart(other)
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'rose', data: [[0, 5], [180, 40], [360, 80]] }), axes: ['angle', 'radius'] }).addToChart(other)
    const tip = new D3PTooltipManager({ bus, series: ['rose'] })
    let shown: D3PTooltipData | undefined
    bus.on(other.event('tooltipShow'), (d) => void (shown = d))
    tip.addToChart(chart)
    tip.addToChart(other)
    chart.emitEvent('mousemove', pointer(chart, 160, 200, 'mousemove'))
    await settle()
    expect(shown!.x).toBeCloseTo(CX) // 180 degrees, 40 % of the radius: straight below the center
    expect(shown!.y).toBeCloseTo(CY + 0.4 * R)
  })

  it('joins axes that share one domain without being told', async () => {
    const { chart } = mixed({ sharedDomain: true })
    const shown = await hover(chart, new D3PTooltipManager({ bus }), 160, 200)
    expect(shown!.series.map((s) => s.renderer.name).sort()).toEqual(['linear', 'rose'])
    expect(shown!.series.find((s) => s.renderer.name === 'rose')!.x).toBe(50)
  })

  it('moves the cursor of another system to the joined value', async () => {
    const { chart } = mixed()
    chart.coords.join({ axes: ['time', 'angle'], convert: (v) => (v as number) * 3.6 })
    new D3PCursorIndicator({ bus }).addToChart(chart)
    const [x, y] = [160, 200] // time 50 on the cartesian axis (inner width 320)
    chart.emitEvent('mousemove', pointer(chart, x, y, 'mousemove'))
    await settle()
    const lines = [...el.querySelectorAll('line.cursor-cross-x')]
    // one vertical line for the time axis, one spoke for the joined angle (180 degrees = straight down)
    expect(lines.length).toBe(2)
    const down = lines.find((l) => l.getAttribute('x1') === l.getAttribute('x2') && +l.getAttribute('x1')! === CX && +l.getAttribute('y2')! > CY + 1 && +l.getAttribute('y1')! < CY + 1)
    expect(down).toBeTruthy()
  })
})
