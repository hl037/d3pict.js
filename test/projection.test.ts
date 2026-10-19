import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  D3PAngleAxis, D3PAreaRenderer, D3PAxis, wrapText, D3PCursorIndicator, D3PCursorRadiusAxisRenderer, D3PAxisDomain, D3PBarRenderer, D3PBus, D3PChart, D3PDotMarker, D3PHeatmapRenderer, D3PInteractionArea, D3PLineRenderer, D3PPanTool,
  D3PPieRenderer, D3PPointerEvent, D3PPolarSystem, D3PProjectionMemo, D3PRadiusAxis, D3PScatterRenderer, D3PWheelZoomTool, D3PSeries, D3PTooltipManager, D3PViewportPoint, d3pProbe, d3pSettle,
  type D3PMarker, type D3PProbeHit,
} from '../src'
import { pointer } from './helpers'

// 400x300 with the default margins: inner area 320x240; polar disc centered at (160, 120), radius 92.
let bus: D3PBus
let el: HTMLElement
const settle = () => d3pSettle(bus)
const mk = () => {
  const c = document.createElement('div')
  document.body.append(c)
  return c
}
const fire = (target: EventTarget, type: string, x: number, y: number, extra: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, buttons: 1, ...extra }))

beforeEach(() => {
  bus = new D3PBus()
  el = mk()
})
afterEach(() => {
  document.body.innerHTML = ''
})

function cartesian(container: HTMLElement = el) {
  const chart = new D3PChart({ container, width: 400, height: 300, bus })
  const dx = new D3PAxisDomain({ bus, domain: [0, 10] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const x = new D3PAxis({ bus, name: 'x', domain: dx })
  const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left' })
  x.addToChart(chart)
  y.addToChart(chart)
  return { chart, dx, dy, x, y }
}

function polar() {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const system = new D3PPolarSystem({ bus, name: 'polar' })
  system.addToChart(chart)
  const angle = new D3PAngleAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }) })
  const radius = new D3PRadiusAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) })
  angle.addToChart(chart)
  radius.addToChart(chart)
  return { chart, system, angle, radius }
}

describe('projections', () => {
  it('go from the domain to the viewport and back, through the axis and the system', () => {
    const { chart, x, y } = cartesian()
    expect(x.projectTo(chart, 5)).toBe(160) // range units of a cartesian system are pixels
    expect(y.projectTo(chart, 50)).toBe(120)
    const system = x.getSystem(chart)!
    const point = system.projectTo(chart, 160, 120)
    expect(point).toBeInstanceOf(D3PViewportPoint)
    expect([point.chart, point.x, point.y]).toEqual([chart, 160, 120])
    expect(system.projectFrom(point)).toEqual([160, 120])
    expect(x.projectFrom(point)).toBe(5)
    expect(y.projectFrom(point)).toBe(50)
  })

  it('answer nothing beyond the reach of a polar system, unless asked not to be strict', () => {
    const { chart, angle, radius } = polar()
    const system = angle.getSystem(chart)!
    const beyond = new D3PViewportPoint(chart, 160, 120 - 92 - 20) // just above the ring
    expect(angle.projectFrom(beyond)).toBeCloseTo(0)
    expect(radius.projectFrom(beyond)).toBeCloseTo(100) // the outer radius, not 122 % of it
    const out = new D3PViewportPoint(chart, 160, 120 - 92 - 130) // further than its reach
    expect(radius.projectFrom(out)).toBeUndefined()
    expect(angle.projectFrom(out)).toBeUndefined()
    expect(system.projectFrom(out)).toBeUndefined()
    const loose = system.projectFrom(out, { strict: false })!
    expect(loose[0]).toBeCloseTo(0)
    expect(loose[1]).toBeCloseTo(222)
    const inside = system.projectTo(chart, Math.PI / 2, 46) // right of the center, half way
    expect(inside.x).toBeCloseTo(160 + 46)
    expect(inside.y).toBeCloseTo(120)
    expect(angle.projectFrom(inside)).toBeCloseTo(90)
    expect(radius.projectFrom(inside)).toBeCloseTo(50)
  })

  it('compute a result once per cache, per projector and per chart', () => {
    const { chart } = cartesian()
    const other = new D3PChart({ container: mk(), width: 400, height: 300, bus })
    const cache = new D3PProjectionMemo()
    const projector = {}
    let calls = 0
    const compute = () => ++calls
    expect(cache.memo(projector, chart, ['k', new Date(5), 'a'], compute)).toBe(1)
    expect(cache.memo(projector, chart, ['k', new Date(5), 'a'], compute)).toBe(1)
    expect(cache.memo(projector, chart, ['k', new Date(6), 'a'], compute)).toBe(2)
    expect(cache.memo(projector, other, ['k', new Date(5), 'a'], compute)).toBe(3) // another chart
    expect(cache.memo({}, chart, ['k', new Date(5), 'a'], compute)).toBe(4) // another projector
  })

  it('share the results of an event between everything that asks, and compute nothing before', () => {
    const { chart, x } = cartesian()
    const event = pointer(chart, 160, 120)
    let reads = 0
    const scale = x.getScale(chart) as any
    const invert = scale.invert.bind(scale)
    scale.invert = (v: number) => (reads++, invert(v))
    expect(reads).toBe(0)
    expect(x.projectFrom(event.point, undefined, event)).toBe(5)
    expect(x.projectFrom(event.point, undefined, event)).toBe(5)
    expect(d3pProbe(chart).projectFrom(event, x)).toBe(5)
    expect(reads).toBe(1)
    x.projectFrom(event.point) // without a cache, it is computed again
    expect(reads).toBe(2)
  })
})

describe('snapshots', () => {
  it('keep the domain, scale and system of the moment, while the live ones move on', () => {
    const { chart, dx, x } = cartesian()
    const event = pointer(chart, 160, 120)
    const snapshot = event.snapshot()
    dx.domain = [0, 20]
    expect(x.projectFrom(event.point)).toBe(10) // live
    const frozen = snapshot.getAxis(x)
    expect(frozen.projectFrom(event.point)).toBe(5)
    expect(frozen.projectTo(chart, 5)).toBe(160)
    expect(frozen.domain).toEqual([0, 10])
    expect(snapshot.getSystem(x.getSystem(chart)!).projectFrom(event.point)).toEqual([160, 120])
  })

  it('keep the geometry of a polar system', () => {
    const { chart, system, angle } = polar()
    const snapshot = pointer(chart, 160, 120).snapshot()
    system.props({ sweep: 180 })
    const frozen = snapshot.getSystem(system)
    expect(frozen.wrap(chart, 'x', 4)).toBeCloseTo(4 - Math.PI * 2) // a full circle wraps...
    expect(system.wrap(chart, 'x', 4)).toBe(4) // ...the live half circle does not
    expect(snapshot.getAxis(angle).scale.range()).toEqual([0, Math.PI * 2])
  })

  it('refuse another chart, and an axis that was not there', () => {
    const { chart, x } = cartesian()
    const other = cartesian(mk())
    const snapshot = pointer(chart, 1, 1).snapshot()
    expect(() => snapshot.getAxis(other.x)).toThrow(/was not on chart/)
    expect(() => snapshot.getAxis(x).projectTo(other.chart, 1)).toThrow(/cannot project on chart/)
  })

  it('make a pan measure against where the drag started', async () => {
    const { chart, dx } = cartesian()
    new D3PInteractionArea({ bus, coalesce: false }).addToChart(chart)
    new D3PPanTool({ bus, axes: ['x'] }).addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', 160, 120)
    await settle()
    for (const x of [176, 192, 208]) {
      fire(document, 'mousemove', x, 120)
      await settle()
    }
    fire(document, 'mouseup', 208, 120, { buttons: 0 })
    await settle()
    // 48 px of a 320 px wide, 10 unit domain: 1.5 units, in one piece
    expect(dx.domain.map(Number).map((v) => +v.toFixed(6))).toEqual([-1.5, 8.5])
  })
})

describe('pointer events', () => {
  it('are emitted by the interaction area with the pixel, the DOM event and the drag start', async () => {
    const { chart } = cartesian()
    new D3PInteractionArea({ bus, coalesce: false }).addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    const moves: D3PPointerEvent[] = []
    const drags: any[] = []
    bus.on(chart.event('mousemove'), (p) => void moves.push(p))
    bus.on(chart.event('drag'), (p) => void drags.push(p))
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    expect(moves[0]).toBeInstanceOf(D3PPointerEvent)
    expect([moves[0].chart, moves[0].x, moves[0].y]).toEqual([chart, 160, 120])
    expect(moves[0].point.x).toBe(160)
    expect(moves[0].original).toBeInstanceOf(MouseEvent)
    fire(rect, 'mousedown', 100, 50)
    await settle()
    fire(document, 'mousemove', 130, 90)
    await settle()
    expect(drags[0].start).toMatchObject({ x: 100, y: 50 })
    expect([drags[0].dx, drags[0].dy]).toEqual([30, 40])
    fire(document, 'mouseup', 130, 90, { buttons: 0 })
  })
})

describe('the probe', () => {
  it('reads the value of an axis from an event of another chart, by name, by join or by domain', () => {
    const a = cartesian()
    const b = cartesian(mk())
    const event = pointer(a.chart, 160, 120)
    const probeB = d3pProbe(b.chart)
    expect(probeB.projectFrom(event, b.x)).toBe(5) // same name
    // an axis of another name needs a join...
    const other = new D3PAxis({ bus, name: 'time', domain: new D3PAxisDomain({ bus, domain: [0, 100] }) })
    other.addToChart(b.chart)
    expect(probeB.projectFrom(event, other)).toBeUndefined()
    expect(probeB.projectFrom(event, other, [{ names: new Set(['x', 'time']) }])).toBe(5)
    // ...unless it shares the domain of an axis that has a value
    const shared = new D3PAxis({ bus, name: 'shared', domain: a.dx })
    shared.addToChart(b.chart)
    expect(probeB.projectFrom(event, shared)).toBe(5)
  })

  it('asks a renderer once per event', () => {
    const { chart } = cartesian()
    const line = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [5, 50], [10, 100]] }) })
    line.addToChart(chart)
    let calls = 0
    const original = line.probeHit.bind(line)
    line.probeHit = (...args) => (calls++, original(...args))
    const event = pointer(chart, 160, 120)
    const probe = d3pProbe(chart)
    const hit = probe.hit(event, line)!
    expect([hit.x, hit.y, hit.index]).toEqual([5, 50, 1])
    expect(hit.range).toEqual([160, 120])
    expect(probe.hit(event, line)).toBe(hit)
    expect(probe.hits(event)).toEqual([hit])
    expect(calls).toBe(1)
    probe.hit(pointer(chart, 160, 120), line) // another event, another computation
    expect(calls).toBe(2)
  })

  it('has no hit for a hidden renderer', () => {
    const { chart } = cartesian()
    const line = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [10, 100]] }) })
    line.addToChart(chart)
    line.visible = false
    expect(d3pProbe(chart).hit(pointer(chart, 160, 120), line)).toBeUndefined()
  })
})

describe('markers', () => {
  const dots = (chart: D3PChart) => chart.layer.markers.selectAll('circle.series-marker')

  function line(chart: D3PChart, marker?: D3PMarker | false) {
    const r = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [5, 50], [10, 100]] }), marker })
    r.addToChart(chart)
    return r
  }

  it('put a dot on the nearest point as the pointer moves, with no tooltip', async () => {
    const { chart } = cartesian()
    line(chart)
    chart.emitEvent('mousemove', pointer(chart, 150, 100))
    await settle()
    expect(dots(chart).size()).toBe(1)
    expect(dots(chart).attr('fill')).toBeTruthy()
    chart.emitEvent('mouseleave', pointer(chart, 150, 100, 'mouseleave'))
    await settle()
    await new Promise((r) => setTimeout(r, 300))
    expect(dots(chart).size()).toBe(0)
  })

  it('can be left out, or replaced by another marker of the renderer', async () => {
    const { chart } = cartesian()
    const none = line(chart, false)
    expect(none.marker).toBeUndefined()
    chart.emitEvent('mousemove', pointer(chart, 150, 100))
    await settle()
    expect(dots(chart).size()).toBe(0)

    const seen: string[] = []
    none.marker = {
      show: (_chart, hit: D3PProbeHit) => void seen.push(`show ${hit.x}`),
      hide: () => void seen.push('hide'),
      remove: () => void seen.push('remove'),
    }
    chart.emitEvent('mousemove', pointer(chart, 150, 100))
    chart.emitEvent('mouseleave', pointer(chart, 150, 100, 'mouseleave'))
    await settle()
    expect(seen).toEqual(['show 5', 'hide'])
    none.marker = new D3PDotMarker(none, { radius: 9 })
    chart.emitEvent('mousemove', pointer(chart, 150, 100))
    await settle()
    await new Promise((r) => setTimeout(r, 300))
    expect(dots(chart).attr('r')).toBe('9')
    expect(seen).toContain('remove') // the old one was told to clean up
  })

  it('mark both ends of a range, and link them', async () => {
    const { chart } = cartesian()
    const band = new D3PSeries({ bus, name: 'band', columns: ['x', 'max', 'min'], data: [[0, 20, 10], [5, 80, 40], [10, 90, 70]] })
    new D3PAreaRenderer({ bus, series: band, props: { base: 'min' } }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 120))
    await settle()
    const circles = chart.layer.markers.selectAll<SVGCircleElement, unknown>('circle.series-marker')
    expect(circles.size()).toBe(2)
    await new Promise((r) => setTimeout(r, 300))
    const ys = circles.nodes().map((c) => +c.getAttribute('cy')!).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(48) // 80 and 40 on a 0-100 axis of 240 px
    expect(ys[1]).toBeCloseTo(144)
    const link = chart.layer.markers.select('line.series-marker-link')
    const ends = [+link.attr('y1'), +link.attr('y2')].sort((a, b) => a - b)
    expect(ends[0]).toBeCloseTo(48)
    expect(ends[1]).toBeCloseTo(144)
    expect(+link.attr('opacity')).toBeGreaterThan(0)
    chart.emitEvent('mouseleave', pointer(chart, 160, 120, 'mouseleave'))
    await settle()
  })

  it('drop what they drew when the renderer leaves the chart', async () => {
    const { chart } = cartesian()
    const r = line(chart)
    chart.emitEvent('mousemove', pointer(chart, 150, 100))
    await settle()
    r.removeFromChart(chart)
    expect(dots(chart).size()).toBe(0)
  })

  it('give each renderer its own default: dots for points, an outline for bars and cells', async () => {
    const scatter = new D3PScatterRenderer({ bus, series: new D3PSeries({ bus, name: 'p', data: [[5, 50]] }) })
    expect(scatter.marker).toBeInstanceOf(D3PDotMarker)
    const bar = new D3PBarRenderer({ bus, series: new D3PSeries({ bus, name: 'b', data: [[5, 50]] }) })
    expect(bar.marker?.constructor.name).toBe('D3PCellMarker')
    expect(new D3PHeatmapRenderer({ bus, series: new D3PSeries({ bus, name: 'h', columns: ['x', 'y', 'value'], data: [] }) }).marker?.constructor.name).toBe('D3PCellMarker')
  })

  it('outline the bar under the pointer', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const x = new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: ['a', 'b'] }), scaleType: 'band' })
    const y = new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 10] }), position: 'left' })
    x.addToChart(chart)
    y.addToChart(chart)
    new D3PBarRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [['a', 5], ['b', 10]] }) }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 240, 100)) // over the second band
    await settle()
    const outline = chart.layer.markers.select('.cell-marker rect')
    expect(outline.size()).toBe(1)
    expect(+outline.attr('x')).toBeGreaterThan(160)
    expect(+outline.attr('height')).toBeCloseTo(240) // the bar of 10 on a 0-10 axis
    chart.emitEvent('mouseleave', pointer(chart, 240, 100, 'mouseleave'))
    await settle()
    expect(chart.layer.markers.selectAll('.cell-marker').size()).toBe(0)
  })

  it('follow the pointer of another chart through the tooltip', async () => {
    const a = cartesian()
    const b = cartesian(mk())
    line(a.chart)
    const second = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 't', data: [[0, 0], [10, 100]] }) })
    second.addToChart(b.chart)
    const tip = new D3PTooltipManager({ bus })
    tip.addToChart(a.chart)
    tip.addToChart(b.chart)
    chart_move(a.chart)
    await settle()
    expect(dots(a.chart).size()).toBe(1)
    expect(dots(b.chart).size()).toBe(1)
  })

  it('light a pie slice by itself, and only when asked to hover', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PPolarSystem({ bus, name: 'polar' }).addToChart(chart)
    const pie = new D3PPieRenderer({ bus, series: new D3PSeries({ bus, name: 'p', data: [['a', 1], ['b', 1]] }) })
    pie.addToChart(chart)
    expect(pie.marker?.interactive).toBe(true)
    pie.props = { hover: false }
    expect(pie.marker?.interactive).toBe(false)
  })
})

function chart_move(chart: D3PChart) {
  chart.emitEvent('mousemove', pointer(chart, 160, 120))
}

describe('several axes on a chart', () => {
  it('stack on one side, outward, with the offset of their options', () => {
    const { chart, dx } = cartesian()
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const second = new D3PAxis({ bus, name: 'second', domain: dy, position: 'left', offset: 56 })
    const right = new D3PAxis({ bus, name: 'right', domain: dy, position: 'right', offset: 56 })
    const top = new D3PAxis({ bus, name: 'top', domain: dx, position: 'top', offset: 20 })
    for (const a of [second, right, top]) a.addToChart(chart)
    expect(second.getTranslation(chart)).toEqual({ x: -56, y: 0 })
    expect(right.getTranslation(chart)).toEqual({ x: 320 + 56, y: 0 })
    expect(top.getTranslation(chart)).toEqual({ x: 0, y: -20 })
    second.addToChart(chart, 80) // another chart, or a later call, may ask for another distance
    expect(second.getTranslation(chart).x).toBe(-56) // already attached: unchanged
  })
})

describe('the wheel', () => {
  it('scrolls the page over a chart that has no wheel tool, and is taken by one that has', () => {
    const { chart } = cartesian()
    new D3PInteractionArea({ bus, coalesce: false }).addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    const wheel = () => {
      const e = new WheelEvent('wheel', { cancelable: true, bubbles: true, deltaY: 1 })
      rect.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(wheel()).toBe(false)
    const tool = new D3PWheelZoomTool({ bus })
    tool.addToChart(chart)
    expect(wheel()).toBe(true)
  })
})

describe('the cursor', () => {
  it('labels each Y axis on its own side', async () => {
    const { chart } = cartesian()
    const dy = new D3PAxisDomain({ bus, domain: [0, 10] })
    new D3PAxis({ bus, name: 'right', domain: dy, position: 'right', offset: 40 }).addToChart(chart)
    new D3PAxis({ bus, name: 'second', domain: dy, position: 'left', offset: 40 }).addToChart(chart)
    new D3PAxis({ bus, name: 'top', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'top' }).addToChart(chart)
    new D3PCursorIndicator({ bus }).addToChart(chart)
    // the cursor follows by name or by shared domain: the pointer is over `x` and `y`, the others share domains with nothing
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [10, 100]] }) }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 120))
    await settle()
    await new Promise((r) => setTimeout(r, 60))
    const boxes = [...chart.layer.overlay.node()!.querySelectorAll('.cursor-labels > g')].map((g) => ({ text: g.querySelector('text')!.textContent, x: +g.querySelector('rect')!.getAttribute('x')!, y: +g.querySelector('rect')!.getAttribute('y')! }))
    // `y` is on the left of the plot (boxes end before x = 0), no axis shares its domain with another here
    const left = boxes.find((b) => b.text === '50')
    expect(left).toBeTruthy()
    expect(left!.x).toBeLessThan(0)
  })

  it('reads the pointer on the left axis and on a right axis that shares its domain, each on its own side', async () => {
    const { chart, dy } = cartesian()
    new D3PAxis({ bus, name: 'right', domain: dy, position: 'right', offset: 40 }).addToChart(chart)
    new D3PCursorIndicator({ bus }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 120))
    await settle()
    await new Promise((r) => setTimeout(r, 60))
    const xs = [...chart.layer.overlay.node()!.querySelectorAll('.cursor-labels > g rect')].map((r) => +r.getAttribute('x')!)
    expect(xs.some((x) => x < 0)).toBe(true) // the left axis
    expect(xs.some((x) => x > 320)).toBe(true) // the right one, beyond the plot
  })
})

describe('the radius axis that follows the pointer', () => {
  it('follows it over the disc and within the reach of the system, and stays where it was farther', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const renderer = new D3PCursorRadiusAxisRenderer()
    new D3PAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }), position: 'angle' }).addToChart(chart)
    new D3PAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'radius', renderer }).addToChart(chart)
    const angleOf = () => ((renderer as any).angles.get(chart) as number | undefined)
    const at = (deg: number, r: number): [number, number] => [160 + r * Math.sin((deg * Math.PI) / 180), 120 - r * Math.cos((deg * Math.PI) / 180)]
    chart.emitEvent('mousemove', pointer(chart, ...at(90, 50)))
    await settle()
    expect(angleOf()).toBeCloseTo(Math.PI / 2)
    chart.emitEvent('mousemove', pointer(chart, ...at(180, 92 + 100))) // within the reach of the system
    await settle()
    expect(angleOf()).toBeCloseTo(Math.PI)
    chart.emitEvent('mousemove', pointer(chart, ...at(270, 92 + 130))) // beyond it: the same angle as before
    await settle()
    expect(angleOf()).toBeCloseTo(Math.PI)
  })
})

describe('a polar radius below its domain', () => {
  it('stays on the inner circle instead of crossing the center', () => {
    const { chart, system, radius } = polar()
    radius.domain.domain = [40, 70] // zoomed in: the values under 40 are outside of it
    const below = radius.projectTo(chart, 20)! // a negative distance
    expect(below).toBeLessThan(0)
    const at = system.projectTo(chart, 0, below)
    expect([at.x, at.y]).toEqual([160, 120]) // not below the center, where an angle of 0 points away from
    const half = polarWithHole()
    const hole = half.system.projectTo(half.chart, Math.PI / 2, -50)
    expect(Math.hypot(hole.x - 160, hole.y - 120)).toBeCloseTo(half.r0)
  })
})

function polarWithHole() {
  const chart = new D3PChart({ container: mk(), width: 400, height: 300, bus })
  const system = new D3PPolarSystem({ bus, name: 'polar', props: { innerRadius: 0.5 } })
  system.addToChart(chart)
  return { chart, system, r0: system.geometry(chart).r0 }
}

describe('the reach of a polar system', () => {
  it('is a property of the system, 112 px by default', () => {
    const { chart, system } = polar()
    expect(system.geometry(chart).reach).toBe(112)
    system.props({ reach: 10 })
    expect(system.geometry(chart).reach).toBe(10)
    const far = new D3PViewportPoint(chart, 160, 120 - 92 - 20)
    expect(system.projectFrom(far)).toBeUndefined()
  })
})

describe('the layers of a chart', () => {
  it('draw the markers above the data and below the cursor and the tooltip', async () => {
    const { chart } = cartesian()
    const order = [...chart.getSvg().querySelectorAll('g[class^="layer-"]')].map((g) => g.getAttribute('class'))
    expect(order.indexOf('layer-markers')).toBeGreaterThan(order.indexOf('layer-annotation'))
    expect(order.indexOf('layer-markers')).toBeLessThan(order.indexOf('layer-overlay'))
    // a marker appears after the tooltip container was created, and stays under it
    new D3PTooltipManager({ bus }).addToChart(chart)
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 's', data: [[0, 0], [10, 100]] }) }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 100, 100))
    await settle()
    expect(chart.layer.markers.selectAll('circle.series-marker').size()).toBe(1)
    expect(chart.layer.overlay.selectAll('circle.series-marker').size()).toBe(0)
  })
})

describe('the labels of the cursor on the axes', () => {
  const measure = (s: string) => s.length * 6

  it('wrap at the spaces, and cut a word that is too long', () => {
    expect(wrapText('Monday 5 January 2026', 70, 5, measure)).toEqual(['Monday 5', 'January', '2026'])
    expect(wrapText('2026-01-05T12:00:00Z', 60, 5, measure)).toEqual(['2026-01-05', 'T12:00:00Z'])
    expect(wrapText('short', 100, 3, measure)).toEqual(['short'])
  })

  it('end with an ellipsis when the height does not allow the lines', () => {
    const lines = wrapText('one two three four five six', 50, 2, measure)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
    expect(Math.max(...lines.map(measure))).toBeLessThanOrEqual(50)
  })

  it('stay within the room next to their axis: a long value wraps on several lines', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const x = new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) })
    const y = new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left', props: { tickFormat: (v) => `the value is ${Math.round(+v)} degrees` } })
    x.addToChart(chart)
    y.addToChart(chart)
    new D3PCursorIndicator({ bus }).addToChart(chart)
    chart.emitEvent('mousemove', pointer(chart, 160, 120))
    await settle()
    await new Promise((r) => setTimeout(r, 60))
    const label = [...chart.layer.overlay.node()!.querySelectorAll('.cursor-labels > g')].find((g) => g.textContent!.includes('degrees'))!
    const lines = [...label.querySelectorAll('text')].map((t) => t.textContent!)
    expect(lines.length).toBeGreaterThan(1) // the margin of 60 px does not hold it on one line
    expect(lines.join(' ')).toBe('the value is 50 degrees')
    const rect = label.querySelector('rect')!
    expect(+rect.getAttribute('x')! + +rect.getAttribute('width')!).toBeLessThanOrEqual(-5 + 0.5) // it ends at the axis
    expect(+rect.getAttribute('x')!).toBeGreaterThanOrEqual(-60 - 0.5) // and does not begin before the chart
  })
})
