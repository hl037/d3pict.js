import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  D3PAnchor, D3PAxis, D3PAxisDomain, D3PBarRenderer, D3PBus, D3PChart, D3PClickZoomTool, D3PCursorIndicator, D3PInteractionArea,
  D3PLegendBundle, D3PLineRenderer, D3PPanTool, D3PPassiveZoomTool, D3PResetTool, D3PSeries, D3PTooltip, D3PToolbox,
  D3PWheelPanTool, D3PWheelZoomTool, D3PZoomSelectionTool, D3PAutoDomain, D3P_INTERACTION_AREA, d3pSettle,
  D3PPointerEvent, D3PTitle, D3PWheelEvent,
} from '../src'
import { valuesAt } from './helpers'

let bus: D3PBus
let el: HTMLElement
const mk = () => {
  const c = document.createElement('div')
  document.body.append(c)
  return c
}
const settle = () => d3pSettle(bus)
const fire = (target: EventTarget, type: string, x: number, y: number, extra: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, buttons: 1, ...extra }))

beforeEach(() => {
  bus = new D3PBus()
  el = mk()
})
afterEach(() => {
  document.body.innerHTML = ''
})

function setup(opts: { withArea?: boolean } = {}) {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const dx = new D3PAxisDomain({ bus, domain: [0, 10] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const ax = new D3PAxis({ bus, name: 'x', domain: dx, position: 'bottom' })
  const ay = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left' })
  const series = new D3PSeries({ bus, name: 's', data: [[0, 0], [5, 50], [10, 100]] })
  const line = new D3PLineRenderer({ bus, series })
  ax.addToChart(chart)
  ay.addToChart(chart)
  line.addToChart(chart)
  const area = opts.withArea === false ? undefined : new D3PInteractionArea({ bus, coalesce: false })
  area?.addToChart(chart)
  return { chart, dx, dy, ax, ay, series, line, area }
}

describe('chart structure and rendering', () => {
  it('builds the layered SVG with correct inner size and clip', () => {
    const { chart } = setup()
    const svg = el.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 300')
    expect(chart.innerWidth).toBe(320)
    expect(chart.innerHeight).toBe(240)
    expect(el.querySelector('.layer-data-front')).toBeTruthy()
    expect(el.querySelectorAll('.layer-data-middle').length).toBe(1)
    expect(el.querySelector('clipPath rect')!.getAttribute('width')).toBe('320')
  })

  it('draws axes and the line, resolving axes through the chart services', async () => {
    const { chart } = setup()
    await settle()
    expect(el.querySelector('.x-axis-x')).toBeTruthy()
    expect(el.querySelector('.y-axis-y')).toBeTruthy()
    expect(chart.axes.getXAxes().map((a) => a.name)).toEqual(['x'])
    await new Promise((r) => setTimeout(r, 300))
    const d = el.querySelector('path.line')!.getAttribute('d')!
    expect(d).toMatch(/^M0,240L160,120L320,0$/)
  })

  it('rejects duplicate axis names within a chart', () => {
    const { chart, dx } = setup()
    const dup = new D3PAxis({ bus, name: 'x', domain: dx, position: 'top' })
    expect(() => dup.addToChart(chart)).toThrow(/already exists/)
    expect(dup.hasChart(chart)).toBe(false)
  })

  it('dedupes dirty requests and redraws on a domain change without transition', async () => {
    const { dx, line } = setup()
    await settle()
    await new Promise((r) => setTimeout(r, 300))
    let renders = 0
    const orig = line.render.bind(line)
    line.render = async (c) => (renders++, orig(c))
    line.tagDirty()
    line.tagDirty()
    line.tagDirty()
    await settle()
    expect(renders).toBe(1)
    dx.domain = [0, 20]
    await settle()
    expect(el.querySelector('path.line')!.getAttribute('d')).toMatch(/^M0,240L80,120L160,0$/)
  })

  it('synchronizes charts that share a domain', async () => {
    const a = setup()
    const el2 = mk()
    const chart2 = new D3PChart({ container: el2, width: 200, height: 200, bus })
    const ax2 = new D3PAxis({ bus, name: 'x', domain: a.dx, position: 'bottom' })
    ax2.addToChart(chart2)
    a.dx.domain = [0, 4]
    await settle()
    expect((ax2.getScale(chart2) as any).domain()).toEqual([0, 4])
    expect((a.ax.getScale(a.chart) as any).domain()).toEqual([0, 4])
  })

  it('applies domain constraints (and re-clamps when they change)', () => {
    const d = new D3PAxisDomain({ bus, domain: [0, 10], props: { rangeMinConstraints: { min: 0 }, rangeMaxConstraints: { max: 10 } } })
    d.domain = [-5, 20]
    expect(d.domain).toEqual([0, 10])
    d.props({ rangeMaxConstraints: { max: 8 } })
    expect(d.domain).toEqual([0, 8])
    expect(d.domain).not.toBe(d.domain) // copies, never the internal array
  })

  it('hides axes (visibility handler is actually subscribed) and removes DOM on detach', async () => {
    const { chart, ax } = setup()
    await settle()
    const g = el.querySelector<SVGGElement>('.x-axis-x')!
    ax.setVisible(false, chart)
    await settle()
    expect(g.style.display).toBe('none')
    ax.removeFromChart(chart)
    expect(el.querySelector('.x-axis-x')).toBeNull()
    expect(chart.axes.getXAxes()).toEqual([])
    await settle() // late render of a removed axis must not throw
  })

  it('draws a grid and removes it when disabled', async () => {
    const { ax } = setup()
    ax.props({ grid: { enabled: true } })
    await settle()
    expect(el.querySelector('.x-grid-x line')).toBeTruthy()
    ax.props({ grid: { enabled: false } })
    await settle()
    expect(el.querySelector('.x-grid-x')).toBeNull()
  })

  it('cleans everything when the chart is destroyed', async () => {
    const { chart, ax, line } = setup()
    await settle()
    chart.destroy()
    await settle()
    expect(el.querySelector('svg')).toBeNull()
    expect(ax.getCharts()).toEqual([])
    expect(line.getCharts()).toEqual([])
  })

  it('exports the SVG', async () => {
    const { chart } = setup()
    expect(await chart.exportSVG()).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('draws bars on a band scale and groups them', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const dx = new D3PAxisDomain({ bus, domain: ['a', 'b'] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 10] })
    new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'band' }).addToChart(chart)
    new D3PAxis({ bus, name: 'y', domain: dy, position: 'left' }).addToChart(chart)
    const bar = new D3PBarRenderer({ bus, series: new D3PSeries({ bus, name: 'b', data: [['a', 5], ['b', 10]] }), props: { count: 2, index: 2 } })
    bar.addToChart(chart)
    await settle()
    await new Promise((r) => setTimeout(r, 350))
    const rects = [...el.querySelectorAll('rect.bar')]
    expect(rects.length).toBe(2)
    expect(Number(rects[1].getAttribute('height'))).toBeCloseTo(240)
    expect(Number(rects[0].getAttribute('height'))).toBeCloseTo(120)
  })
})

describe('svg and container sizing', () => {
  it('never lets an automatic chart size its own container (no endless growth)', async () => {
    const chart = new D3PChart({ container: el, bus })
    const svg = el.querySelector('svg')!
    expect(svg.style.display).toBe('block')
    expect(svg.style.position).toBe('absolute')
    expect(el.style.position).toBe('relative')
    expect(await chart.exportSVG()).not.toContain('position')
    chart.destroy()
    expect(el.style.position).toBe('')
  })

  it('keeps a fixed-size chart in the flow so its container wraps it', () => {
    new D3PChart({ container: el, width: 300, height: 200, bus })
    const svg = el.querySelector('svg')!
    expect(svg.style.display).toBe('block')
    expect(svg.style.position).toBe('')
  })
})

describe('interaction and tools', () => {
  it('translates mouse events into chart events whose pointer projects to domain values', async () => {
    const { chart } = setup()
    const seen: any[] = []
    bus.on(chart.event('mousemove'), (p) => void seen.push(p))
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    expect(seen[0]).toBeInstanceOf(D3PPointerEvent)
    expect(valuesAt(chart, seen[0].x, seen[0].y)).toEqual({ x: 5, y: 50 })
    expect(chart.get(D3P_INTERACTION_AREA)).toBeTruthy()
  })

  it('pans by dragging, without drift, and ends the drag outside the rectangle', async () => {
    const { chart, dx } = setup()
    const pan = new D3PPanTool({ bus, axes: ['x'] })
    pan.addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', 160, 100)
    await settle()
    fire(document, 'mousemove', 128, 100) // 32px left = 1 unit of x
    await settle()
    expect(dx.domain[0]).toBeCloseTo(1)
    expect(dx.domain[1]).toBeCloseTo(11)
    fire(document, 'mousemove', 96, 100)
    await settle()
    expect(dx.domain[0]).toBeCloseTo(2) // measured from the start, not accumulated drift
    fire(document, 'mouseup', 96, 100, { buttons: 0 })
    await settle()
  })

  it('zooms with the wheel around the pointer and pans with the wheel', async () => {
    const { chart, dx, dy } = setup()
    const wz = new D3PWheelZoomTool({ bus })
    wz.addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    rect.dispatchEvent(Object.assign(new MouseEvent('wheel', { clientX: 0, clientY: 240, bubbles: true }), { deltaY: -1 }))
    await settle()
    // zoom in 10 % anchored at the bottom-left corner
    expect(dx.domain[0]).toBeCloseTo(0)
    expect(dx.domain[1]).toBeCloseTo(10 / 1.1)
    expect(dy.domain[0]).toBeCloseTo(0)
    expect(dy.domain[1]).toBeCloseTo(100 / 1.1)
    wz.removeFromChart(chart)
    const wp = new D3PWheelPanTool({ bus, axes: ['x'] })
    wp.addToChart(chart)
    const before = dx.domain[0] as number
    rect.dispatchEvent(Object.assign(new MouseEvent('wheel', { bubbles: true }), { deltaY: 1 }))
    await settle()
    expect((dx.domain[0] as number) - before).toBeCloseTo(((dx.domain[1] as number) - before) * 0.0909, 1)
  })

  it('zoom tools agree: zoomIn shrinks the domain, zoomOut grows it', () => {
    const { chart, dx } = setup()
    const click = new D3PClickZoomTool({ bus, axes: ['x'] })
    const passive = new D3PPassiveZoomTool({ bus, axes: ['x'] })
    click.addToChart(chart)
    passive.addToChart(chart)
    click.zoomInAll()
    const afterClick = (dx.domain[1] as number) - (dx.domain[0] as number)
    expect(afterClick).toBeCloseTo(8)
    dx.domain = [0, 10]
    passive.zoomInAll()
    expect((dx.domain[1] as number) - (dx.domain[0] as number)).toBeCloseTo(8)
    passive.zoomOutAll()
    expect((dx.domain[1] as number) - (dx.domain[0] as number)).toBeCloseTo(10)
  })

  it('zooms to a selection and resets', async () => {
    const { chart, dx, dy } = setup()
    const sel = new D3PZoomSelectionTool({ bus })
    const reset = new D3PResetTool({ bus })
    sel.addToChart(chart)
    reset.addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', 32, 24)
    await settle()
    fire(document, 'mousemove', 96, 120)
    await settle()
    expect(el.querySelector('.zoom-selection')).toBeTruthy()
    fire(document, 'mouseup', 96, 120, { buttons: 0 })
    await settle()
    expect(el.querySelector('.zoom-selection')).toBeNull()
    expect(dx.domain).toEqual([1, 3])
    expect(dy.domain).toEqual([50, 90])
    reset.reset()
    expect(dx.domain).toEqual([0, 10])
    expect(dy.domain).toEqual([0, 100])
  })

  it('a click without movement is not a selection', async () => {
    const { chart, dx } = setup()
    new D3PZoomSelectionTool({ bus }).addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousedown', 32, 24)
    await settle()
    fire(document, 'mouseup', 32, 24, { buttons: 0 })
    await settle()
    expect(dx.domain).toEqual([0, 10])
  })

  it('toolbox attaches active tools, handles exclusion groups and new charts', async () => {
    const { chart, dx } = setup()
    const box = new D3PToolbox({ bus, mutuallyExclusiveGroups: [['pan', 'zoom-selection']] })
    const pan = new D3PPanTool({ bus })
    const sel = new D3PZoomSelectionTool({ bus })
    box.addTool(pan)
    box.addTool(sel)
    expect(() => box.addTool(new D3PPanTool({ bus }))).toThrow()
    box.addToChart(chart)
    box.setToolActive('pan')
    expect(pan.hasChart(chart)).toBe(true)
    box.setToolActive('zoom-selection')
    expect(box.isToolActive('pan')).toBe(false)
    expect(pan.hasChart(chart)).toBe(false)
    expect(sel.hasChart(chart)).toBe(true)
    expect(box.getActiveTool()).toBe(sel)
    expect(() => box.setToolActive('nope')).toThrow()
    const chart2 = new D3PChart({ container: mk(), width: 100, height: 100, bus })
    box.addToChart(chart2)
    expect(sel.hasChart(chart2)).toBe(true)
    box.deactivateAll()
    expect(box.hasToolActive()).toBe(false)
    expect(dx.domain).toEqual([0, 10])
  })

  it('asks for an interaction area when none exists', async () => {
    const { chart } = setup({ withArea: false })
    let asked = 0
    bus.on(chart.event('needInteractionArea'), () => void asked++)
    new D3PPanTool({ bus }).addToChart(chart)
    await settle()
    expect(asked).toBe(1)
  })
})

describe('cursor, tooltip, legend, anchors', () => {
  it('shows the cursor cross and labels, and hides on leave', async () => {
    const { chart } = setup()
    const cursor = new D3PCursorIndicator({ bus })
    cursor.addToChart(chart)
    const rect = el.querySelector('rect.interaction-area')!
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    const g = el.querySelector<SVGGElement>('.cursor-indicator')!
    expect(g.style.display).not.toBe('none')
    expect(el.querySelector('.cursor-cross-x')!.getAttribute('x1')).toBe('160')
    expect(el.querySelectorAll('.cursor-labels g').length).toBe(2)
    fire(rect, 'mouseleave', 160, 120, { buttons: 0 })
    await settle()
    expect(g.style.display).toBe('none')
  })

  it('computes tooltip data across charts and positions the container', async () => {
    const a = setup()
    const chart2 = new D3PChart({ container: mk(), width: 400, height: 300, bus })
    const ax2 = new D3PAxis({ bus, name: 'x', domain: a.dx, position: 'bottom' })
    const ay2 = new D3PAxis({ bus, name: 'y2', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'left' })
    const s2 = new D3PSeries({ bus, name: 's2', data: [[0, 0], [5, 0.5], [10, 1]] })
    const l2 = new D3PLineRenderer({ bus, series: s2, axes: ['x', 'y2'] })
    ax2.addToChart(chart2)
    ay2.addToChart(chart2)
    l2.addToChart(chart2)
    new D3PInteractionArea({ bus, coalesce: false }).addToChart(chart2)
    const tip = new D3PTooltip({ bus })
    tip.addToChart(a.chart)
    tip.addToChart(chart2)
    const shown: any[] = []
    const shown2: any[] = []
    bus.on(tip.manager.e.show, (d) => void shown.push(d))
    bus.on(chart2.event('tooltipShow'), (d) => void shown2.push(d))
    await settle()
    fire(el.querySelector('rect.interaction-area')!, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    expect(shown[0].series.map((s: any) => s.renderer.name).sort()).toEqual(['s', 's2'])
    expect(shown[0].series.find((s: any) => s.renderer.name === 's').y).toBe(50)
    expect(shown2[0].series.length).toBe(1)
    expect(shown2[0].y).toBeCloseTo(120)
    expect(shown[0].xSide).toBe('right')
    expect(el.querySelector<HTMLElement>('.html-container div')!.style.display).toBe('block')
    // each line shows its dot, on its own chart: the second one is told by the tooltip, which spans both
    expect(a.chart.layer.markers.selectAll('circle.series-marker').size()).toBe(1)
    expect(chart2.layer.markers.selectAll('circle.series-marker').size()).toBe(1)

    // hidden series are no longer part of the tooltip
    a.line.visible = false
    await settle()
    fire(el.querySelector('rect.interaction-area')!, 'mousemove', 100, 120, { buttons: 0 })
    await settle()
    expect(shown.at(-1).series.map((s: any) => s.renderer.name)).toEqual(['s2'])

    const hid: number[] = []
    bus.on(tip.manager.e.hide, () => void hid.push(1))
    fire(el.querySelector('rect.interaction-area')!, 'mouseleave', 0, 0, { buttons: 0 })
    await settle()
    expect(hid.length).toBe(1)
    expect(el.querySelector<HTMLElement>('.html-container div')!.style.display).toBe('none')
  })

  it('tooltip handles the value 0 (not treated as missing)', async () => {
    const { chart } = setup()
    const tip = new D3PTooltip({ bus })
    tip.addToChart(chart)
    const shown: any[] = []
    bus.on(tip.manager.e.show, (d) => void shown.push(d))
    fire(el.querySelector('rect.interaction-area')!, 'mousemove', 0, 240, { buttons: 0 })
    await settle()
    expect(shown[0].series[0].x).toBe(0)
  })

  it('emits legends and follows visibility', async () => {
    const { chart, line } = setup()
    const legend = new D3PLegendBundle({ bus })
    legend.addToChart(chart)
    await settle()
    const entries = legend.container.getData(chart)!.series
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ renderer: line, key: 'series', label: 's', color: line.color, visible: true })
    line.visible = false
    await settle()
    expect(legend.container.getData(chart)!.series[0].visible).toBe(false)
    legend.container.getData(chart)!.series[0].toggle() // an entry shows and hides what it stands for
    await settle()
    expect(line.visible).toBe(true)
  })

  it('keeps clickable HTML (legend, anchors) above the interaction area, which would otherwise swallow the clicks', async () => {
    const { chart } = setup()
    const legend = new D3PLegendBundle({ bus })
    legend.addToChart(chart)
    await settle()
    const fo = el.querySelector('foreignObject.html-container')!
    expect(fo.parentElement!.getAttribute('class')).toBe('layer-interaction-front')
    const area = el.querySelector('rect.interaction-area')!
    // later in the document = drawn on top of the area
    expect(area.compareDocumentPosition(fo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('anchors expose a container per chart and announce changes', async () => {
    const { chart } = setup()
    const anchor = new D3PAnchor({ bus })
    let changed = 0
    bus.on(anchor.e.changed, () => void changed++)
    anchor.addToChart(chart)
    await settle()
    expect(anchor.getContainers().length).toBe(1)
    anchor.removeFromChart(chart)
    await settle()
    expect(changed).toBe(2)
  })

  it('auto domain fits series extents with union and ignores NaN', async () => {
    const chart = new D3PChart({ container: el, width: 300, height: 200, bus })
    void chart
    const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
    const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
    const s1 = new D3PSeries({ bus, name: 'a', data: [[1, 5], [3, NaN]] })
    const s2 = new D3PSeries({ bus, name: 'b', data: [[2, -4], [9, 7]] })
    const auto = new D3PAutoDomain({ bus })
    auto.linkSeries(s1, [dx, dy])
    auto.linkSeries(s2, [dx, dy])
    await settle()
    expect(dx.domain).toEqual([1, 9])
    expect(dy.domain).toEqual([-4, 7])
    auto.active = false
    s2.data = [[0, 0]]
    await settle()
    expect(dx.domain).toEqual([1, 9])
    auto.active = true
    await settle()
    expect(dx.domain).toEqual([0, 3])
  })
})

describe('wheel-pan axes', () => {
  it('moves only the X axes by default, and the given axes when a filter is set', async () => {
    const { chart, dx, dy, area } = setup()
    const tool = new D3PWheelPanTool({ bus })
    tool.addToChart(chart)
    await settle()
    const wheel = (delta: number) => chart.emitEvent('wheel', new D3PWheelEvent(chart, 10, 10, new WheelEvent('wheel', { deltaY: delta })))
    await wheel(1)
    await settle()
    expect(dx.domain.map(Number)).toEqual([1, 11])
    expect(dy.domain.map(Number)).toEqual([0, 100])

    tool.removeFromChart(chart)
    const both = new D3PWheelPanTool({ bus, axes: ['x', 'y'] })
    both.addToChart(chart)
    await settle()
    await wheel(1)
    await settle()
    expect(dy.domain.map(Number)).toEqual([10, 110])
    void area
  })
})

describe('what is under a still pointer', () => {
  /** The moves of the chart, as `[x, y]`, in the order they came. */
  function moves(chart: D3PChart) {
    const seen: D3PPointerEvent[] = []
    bus.on(chart.event('mousemove'), (p) => void seen.push(p))
    return seen
  }

  it('is read again when the scale changes: a zoom with the pointer still moves the markers and the tooltip', async () => {
    const { chart, dx, series, line } = setup()
    new D3PTooltip({ bus }).addToChart(chart)
    await settle()
    const rect = el.querySelector('rect.interaction-area')!
    const seen = moves(chart)
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    expect(seen).toHaveLength(1)
    const before = el.querySelector('.series-marker')!.getAttribute('cx')

    dx.domain = [2, 6] // a zoom: nothing else happens, the pointer does not move
    await settle()
    await new Promise((r) => setTimeout(r, 300))
    expect(seen).toHaveLength(2)
    expect([seen[1].x, seen[1].y]).toEqual([seen[0].x, seen[0].y]) // the same pixel
    expect(seen[1]).not.toBe(seen[0]) // an event of its own: nothing is kept from the old scale
    expect(el.querySelector('.series-marker')!.getAttribute('cx')).not.toBe(before)
    expect(line.marker).toBeTruthy()
    expect(series.data).toHaveLength(3)
  })

  it('is read again when the data of a series changes, or the series is hidden', async () => {
    const { chart, series, line } = setup()
    await settle()
    const rect = el.querySelector('rect.interaction-area')!
    const seen = moves(chart)
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    series.data = [[0, 10], [5, 60], [10, 90]]
    await settle()
    expect(seen).toHaveLength(2)
    line.visible = false
    await settle()
    expect(seen).toHaveLength(3)
  })

  it('is not read again once the pointer has left the chart', async () => {
    const { chart, dx } = setup()
    await settle()
    const rect = el.querySelector('rect.interaction-area')!
    const seen = moves(chart)
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    fire(rect, 'mouseleave', 160, 120, { buttons: 0 })
    await settle()
    dx.domain = [2, 6]
    await settle()
    expect(seen).toHaveLength(1)
  })

  it('does not run in a loop: one change gives one more move', async () => {
    const { chart, dx } = setup()
    new D3PTooltip({ bus }).addToChart(chart)
    new D3PCursorIndicator({ bus }).addToChart(chart)
    await settle()
    const rect = el.querySelector('rect.interaction-area')!
    const seen = moves(chart)
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    dx.domain = [2, 6]
    await settle()
    await new Promise((r) => setTimeout(r, 400))
    expect(seen).toHaveLength(2)
  })

  it('merges a burst of changes into one move per frame', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    const dx = new D3PAxisDomain({ bus, domain: [0, 10] })
    new D3PAxis({ bus, name: 'x', domain: dx }).addToChart(chart)
    new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left' }).addToChart(chart)
    new D3PInteractionArea({ bus }).addToChart(chart) // the default: bursts are coalesced
    await settle()
    const rect = el.querySelector('rect.interaction-area')!
    const seen = moves(chart)
    fire(rect, 'mousemove', 160, 120, { buttons: 0 })
    await new Promise((r) => setTimeout(r, 60))
    const first = seen.length
    for (const d of [[1, 9], [2, 8], [3, 7], [4, 6]]) dx.domain = d
    await settle()
    await new Promise((r) => setTimeout(r, 60))
    expect(seen.length - first).toBe(1)
  })
})

describe('exports of a chart', () => {
  const rects = (svg: string) => [...new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('svg > rect')]

  it('has a background and a text color of its own, so that the file does not depend on the page', async () => {
    const { chart } = setup()
    const doc = new DOMParser().parseFromString(await chart.exportSVG(), 'image/svg+xml')
    const svg = doc.documentElement
    expect(svg.getAttribute('style')).toMatch(/^color: #000(;|$)/)
    const first = svg.querySelector(':scope > rect')!
    expect(first.getAttribute('fill')).toBe('#fff')
    expect(first.getAttribute('width')).toBe('100%')
    expect(svg.getAttribute('width')).toBe('400')

    const dark = new DOMParser().parseFromString(await chart.exportSVG({ background: '#111', color: '#eee' }), 'image/svg+xml').documentElement
    expect(dark.getAttribute('style')).toMatch(/^color: #eee(;|$)/)
    expect(dark.querySelector(':scope > rect')!.getAttribute('fill')).toBe('#111')

    const transparent = await chart.exportSVG({ background: null })
    expect(rects(transparent).filter((r) => r.getAttribute('width') === '100%')).toHaveLength(0)
  })

  it('leaves out what only has a meaning on screen, and keeps the rest', async () => {
    const { chart, line } = setup()
    new D3PCursorIndicator({ bus }).addToChart(chart)
    new D3PTooltip({ bus }).addToChart(chart)
    await settle()
    fire(el.querySelector('rect.interaction-area')!, 'mousemove', 160, 120, { buttons: 0 })
    await settle()
    await new Promise((r) => setTimeout(r, 300))
    // what the pointer made is on screen...
    expect(el.querySelector('.series-marker')).toBeTruthy()
    expect(el.querySelector('.cursor-indicator')).toBeTruthy()
    expect(el.querySelector('[data-d3pict-transient]')).toBeTruthy()
    const svg = await chart.exportSVG()
    // ...and not in the file
    for (const left of ['interaction-area', 'cursor-indicator', 'cursor-labels', 'series-marker', 'data-d3pict-transient', 'layer-markers']) expect(svg, left).not.toContain(left)
    // the chart is
    expect(svg).toContain('class="line"')
    expect(svg).toContain('x-axis')
    expect(line.isDestroying).toBe(false)
    expect(el.querySelector('.series-marker')).toBeTruthy() // the live chart is not touched
  })

  it('keeps the HTML parts of the chart: the titles and the legends', async () => {
    const { chart } = setup()
    new D3PTitle({ bus, props: { text: 'Exported title' } }).addToChart(chart)
    await settle()
    expect(await chart.exportSVG()).toContain('Exported title')
  })

  describe('as a PNG', () => {
    const real = { Image: (globalThis as any).Image, getContext: HTMLCanvasElement.prototype.getContext, toDataURL: HTMLCanvasElement.prototype.toDataURL }
    let sources: string[]
    let sizes: [number, number][]
    let taint = false
    beforeEach(() => {
      sources = []
      sizes = []
      taint = false
      ;(globalThis as any).Image = class {
        onload?: () => void
        onerror?: () => void
        set src(value: string) {
          sources.push(value)
          queueMicrotask(() => this.onload?.())
        }
      }
      HTMLCanvasElement.prototype.getContext = (function (this: HTMLCanvasElement) {
        return { drawImage: () => sizes.push([this.width, this.height]) }
      }) as never
      HTMLCanvasElement.prototype.toDataURL = function () {
        // a canvas that held an image with HTML in it cannot be read back by some browsers
        if (taint && decodeURIComponent(sources.at(-1)!).includes('foreignObject')) throw new DOMException('Tainted canvases may not be exported.', 'SecurityError')
        return 'data:image/png;base64,AAAA'
      }
    })
    afterEach(() => {
      ;(globalThis as any).Image = real.Image
      HTMLCanvasElement.prototype.getContext = real.getContext
      HTMLCanvasElement.prototype.toDataURL = real.toDataURL
    })

    it('draws the svg, as a data URL, `scale` times bigger', async () => {
      const { chart } = setup()
      expect(await chart.exportPNG()).toBe('data:image/png;base64,AAAA')
      expect(sizes.at(-1)).toEqual([800, 600]) // twice a chart of 400 x 300
      await chart.exportPNG({ scale: 3 })
      expect(sizes.at(-1)).toEqual([1200, 900])
      expect(sources.at(-1)!.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true) // a blob URL would taint the canvas
      expect(decodeURIComponent(sources.at(-1)!)).toContain('fill="#fff"')
    })

    it('draws the chart without its HTML when the browser would not let it be read back, and says so', async () => {
      const { chart } = setup()
      new D3PTitle({ bus, props: { text: 'Exported title' } }).addToChart(chart)
      await settle()
      taint = true
      const warn = console.warn
      const warned: string[] = []
      console.warn = (m: string) => void warned.push(m)
      try {
        expect(await chart.exportPNG()).toBe('data:image/png;base64,AAAA')
      } finally {
        console.warn = warn
      }
      expect(sources).toHaveLength(2)
      expect(decodeURIComponent(sources[0])).toContain('foreignObject')
      expect(decodeURIComponent(sources[1])).not.toContain('foreignObject')
      expect(warned).toHaveLength(1)
      expect(warned[0]).toContain('exportSVG')
    })

    it('does not hang when the image cannot be loaded: it fails', async () => {
      const { chart } = setup()
      ;(globalThis as any).Image = class {
        onerror?: () => void
        set src(_: string) {
          queueMicrotask(() => this.onerror?.())
        }
      }
      await expect(chart.exportPNG()).rejects.toThrow('failed to load')
    })
  })

  it('downloads under the name it is given', async () => {
    const { chart } = setup()
    const created: Blob[] = []
    const real = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: HTMLAnchorElement.prototype.click }
    const downloads: string[] = []
    URL.createObjectURL = ((blob: Blob) => (created.push(blob), 'blob:x')) as never
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = function () {
      downloads.push(this.download)
    }
    try {
      await chart.downloadSVG('my-chart.svg', { background: null })
      await chart.downloadSVG()
      expect(downloads).toEqual(['my-chart.svg', 'chart.svg'])
      expect(created[0].type).toBe('image/svg+xml;charset=utf-8')
      expect(await created[0].text()).not.toContain('fill="#fff"') // the options are passed on
      expect(await created[1].text()).toContain('fill="#fff"')
    } finally {
      URL.createObjectURL = real.create
      URL.revokeObjectURL = real.revoke
      HTMLAnchorElement.prototype.click = real.click
    }
  })
})
