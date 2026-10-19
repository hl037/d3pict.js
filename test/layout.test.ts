import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  D3PAttachable, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PBus, D3PTooltip, d3pDomTooltip, D3PChart, D3PLegendPanel, D3PLineRenderer, D3PPolarSystem, D3PSeries, D3PSlot, D3PTitle, d3pSettle,
} from '../src'
import { D3PRSlot } from '../src/react'
import { D3PVPlugin, D3PVSlot } from '../src/vue'

let bus: D3PBus
let el: HTMLElement
const settle = () => d3pSettle(bus)
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  bus = new D3PBus()
  el = document.createElement('div')
  document.body.append(el)
})
afterEach(() => (document.body.innerHTML = ''))

// 400x300 with the default margins (top 20, right 20, bottom 40, left 60): a plot of 320x240
function chartWithAxes() {
  const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
  const x = new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: [0, 10] }), props: { displayName: 'time' } })
  const y = new D3PAxis({ bus, name: 'y', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left', props: { displayName: 'load' } })
  x.addToChart(chart)
  y.addToChart(chart)
  return { chart, x, y }
}

describe('the layout', () => {
  it('takes the room of the strips from the plot, and gives it back', async () => {
    const { chart, x } = chartWithAxes()
    const resized: unknown[] = []
    bus.on(chart.e.resized, (s) => void resized.push(s))
    const band = chart.layout.reserve('top', 30)
    expect(chart.margin.top).toBe(50)
    expect(chart.innerHeight).toBe(210)
    expect(chart.baseMargin.top).toBe(20) // the margin given to the chart is not touched
    await settle()
    expect(resized.length).toBeGreaterThan(0)
    expect((x.getScale(chart) as any).range()).toEqual([0, 320]) // the other dimension is unchanged
    band.size = 10
    expect(chart.innerHeight).toBe(230)
    band.release()
    expect(chart.innerHeight).toBe(240)
    expect(chart.getSvg().querySelector('.layer-clip, clipPath rect')!.getAttribute('height')).toBe('240')
  })

  it('stacks the strips of one side from the edge inward, in the order they were reserved', () => {
    const { chart } = chartWithAxes()
    const first = chart.layout.reserve('left', 20)
    const second = chart.layout.reserve('left', 30)
    chart.layout.reserve('bottom', 24)
    expect(first.rect()).toEqual({ x: 0, y: 20, width: 20, height: 300 - 20 - (40 + 24) })
    expect(second.rect().x).toBe(20)
    expect(chart.margin.left).toBe(110)
    // a strip along the whole chart ignores the margins
    const full = chart.layout.reserve('top', 10, 'chart')
    expect(full.rect()).toEqual({ x: 0, y: 0, width: 400, height: 10 })
  })

  it('moves the plot, whatever is attached to it', async () => {
    const { chart } = chartWithAxes()
    chart.layout.reserve('left', 40)
    expect(chart.getSvg().querySelector('g > g.layer-background')!.parentElement!.getAttribute('transform')).toBe('translate(100,20)')
  })
})

describe('a slot', () => {
  it('reserves a strip and gives an element placed on it', async () => {
    const { chart } = chartWithAxes()
    const slot = new D3PSlot({ bus, side: 'top', size: 30 })
    slot.addToChart(chart)
    const box = slot.getContainer(chart)!
    expect(box).toBeInstanceOf(HTMLElement)
    expect(chart.innerHeight).toBe(210)
    const fo = box.closest('foreignObject')!
    expect([+fo.getAttribute('x')!, +fo.getAttribute('y')!, +fo.getAttribute('width')!, +fo.getAttribute('height')!]).toEqual([60, 0, 320, 30])
    slot.size = 50
    await settle()
    expect(chart.innerHeight).toBe(190)
    chart.resize(500, 300)
    await settle()
    expect(+fo.getAttribute('width')!).toBe(420) // follows the plot along its side
    slot.removeFromChart(chart)
    expect(chart.innerHeight).toBe(240)
    expect(chart.getSvg().querySelector('foreignObject')).toBeNull()
  })

  it('can float over the plot instead, reserving nothing', () => {
    const { chart } = chartWithAxes()
    const slot = new D3PSlot({ bus, side: 'inside' })
    slot.addToChart(chart)
    expect(chart.innerHeight).toBe(240)
    const fo = slot.getContainer(chart)!.closest('foreignObject')!
    expect([+fo.getAttribute('x')!, +fo.getAttribute('y')!, +fo.getAttribute('width')!, +fo.getAttribute('height')!]).toEqual([60, 20, 320, 240])
  })

  it('takes content from Vue and from React', async () => {
    const { chart } = chartWithAxes()
    const slot = new D3PSlot({ bus, side: 'bottom', size: 20 })
    slot.addToChart(chart)
    const vue = document.createElement('div')
    document.body.append(vue)
    const app = createApp({ render: () => h(D3PVSlot, { slot }, { default: () => h('b', { class: 'from-vue' }, 'hello') }) }).use(D3PVPlugin)
    app.mount(vue)
    await wait()
    expect(slot.getContainer(chart)!.querySelector('.from-vue')!.textContent).toBe('hello')
    app.unmount()

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
    root.render(createElement(D3PRSlot, { slot, children: () => createElement('i', { className: 'from-react' }, 'bonjour') }))
    await wait(80)
    expect(slot.getContainer(chart)!.querySelector('.from-react')!.textContent).toBe('bonjour')
    root.unmount()
  })
})

describe('the standard titles', () => {
  it('put a title over the plot, and a subtitle under it', () => {
    const { chart } = chartWithAxes()
    const title = new D3PTitle({ bus, props: { text: 'Load', subtitle: 'last hour' } })
    title.addToChart(chart)
    expect(chart.getSvg().querySelector('.d3pict-title')!.textContent).toBe('Load')
    expect(chart.getSvg().querySelector('.d3pict-subtitle')!.textContent).toBe('last hour')
    const taller = chart.margin.top
    title.props({ subtitle: '' }) // no subtitle: less room
    expect(chart.getSvg().querySelector('.d3pict-subtitle')).toBeNull()
    expect(chart.margin.top).toBeLessThan(taller)
    title.props.align = 'end'
    expect((chart.getSvg().querySelector('.d3pict-title') as HTMLElement).parentElement!.style.alignItems).toBe('flex-end')
    title.removeFromChart(chart)
    expect(chart.margin.top).toBe(20)
  })

  it('title an axis on its side, turned to read along it', () => {
    const { chart } = chartWithAxes()
    new D3PAxisTitle({ bus, axis: 'y' }).addToChart(chart)
    new D3PAxisTitle({ bus, axis: 'x', props: { text: 'time (s)' } }).addToChart(chart)
    const [left, bottom] = [...chart.getSvg().querySelectorAll<HTMLElement>('.d3pict-axis-title')]
    expect(left.textContent).toBe('load') // the display name of the axis
    expect(left.style.writingMode).toBe('vertical-rl')
    expect(left.style.transform).toBe('rotate(180deg)')
    expect(bottom.textContent).toBe('time (s)')
    expect(bottom.style.writingMode).toBe('horizontal-tb')
  })

  describe('against the tick labels', () => {
    const rect = (el: Element) => {
      const fo = el.closest('foreignObject')!
      return { x: +fo.getAttribute('x')!, y: +fo.getAttribute('y')!, width: +fo.getAttribute('width')!, height: +fo.getAttribute('height')! }
    }

    it('sits a gap away from the labels when the margin has room for it, and takes none from the plot', async () => {
      const { chart, y } = chartWithAxes()
      vi.spyOn(y, 'getExtent').mockReturnValue(30) // the labels are 30 px wide
      new D3PAxisTitle({ bus, axis: y }).addToChart(chart)
      await settle()
      await wait()
      expect(chart.margin.left).toBe(60) // 30 + 6 + 18 = 54 fits in the margin
      const left = rect(chart.getSvg().querySelector('.d3pict-axis-title')!)
      expect(left.x).toBe(60 - 54) // against the labels, not at the edge of the chart
      expect(left.width).toBe(18)
    })

    it('asks the plot for room when the labels are wider than the margin', async () => {
      const { chart, y } = chartWithAxes()
      vi.spyOn(y, 'getExtent').mockReturnValue(70)
      new D3PAxisTitle({ bus, axis: y, props: { gap: 10 } }).addToChart(chart)
      await settle()
      await wait()
      expect(chart.margin.left).toBe(70 + 10 + 18)
      expect(chart.innerWidth).toBe(400 - 98 - 20)
      expect(rect(chart.getSvg().querySelector('.d3pict-axis-title')!).x).toBe(0)
    })

    it('only grows with the labels, so a title does not wobble while the scale changes', async () => {
      const { chart, y } = chartWithAxes()
      const extent = vi.spyOn(y, 'getExtent').mockReturnValue(40)
      const title = new D3PAxisTitle({ bus, axis: y })
      title.addToChart(chart)
      await settle()
      await wait()
      const x = rect(chart.getSvg().querySelector('.d3pict-axis-title')!).x
      extent.mockReturnValue(25)
      title.tagDirty(chart)
      await settle()
      await wait()
      expect(rect(chart.getSvg().querySelector('.d3pict-axis-title')!).x).toBe(x)
    })

    it('puts a title on each of the axes of a side, against its own labels', async () => {
      const { chart, y } = chartWithAxes()
      const second = new D3PAxis({ bus, name: 'second', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'left', offset: 80, props: { displayName: 'ratio' } })
      second.addToChart(chart)
      vi.spyOn(y, 'getExtent').mockReturnValue(30)
      vi.spyOn(second, 'getExtent').mockReturnValue(24)
      new D3PAxisTitle({ bus, axis: y }).addToChart(chart)
      new D3PAxisTitle({ bus, axis: second }).addToChart(chart)
      await settle()
      await wait()
      const [first, other] = [...chart.getSvg().querySelectorAll('.d3pict-axis-title')].map(rect)
      // the first one is between the plot and the second axis (54 from the plot), the second one beyond its labels (80 + 24 + 6 + 18)
      expect(first.x).toBe(chart.margin.left - 54)
      expect(other.x).toBe(chart.margin.left - 128)
      expect(chart.margin.left).toBe(128) // the margin has to hold both
    })

    it('goes on the outer side of a right axis and of a top one', async () => {
      const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
      const right = new D3PAxis({ bus, name: 'r', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'right' })
      const top = new D3PAxis({ bus, name: 't', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'top' })
      right.addToChart(chart)
      top.addToChart(chart)
      vi.spyOn(right, 'getExtent').mockReturnValue(20)
      vi.spyOn(top, 'getExtent').mockReturnValue(12)
      new D3PAxisTitle({ bus, axis: right }).addToChart(chart)
      new D3PAxisTitle({ bus, axis: top }).addToChart(chart)
      await settle()
      await wait()
      const [r, t] = [...chart.getSvg().querySelectorAll('.d3pict-axis-title')].map(rect)
      // 44 and 36 px from the plot: the labels, a gap and the title; the margin has grown to hold them
      expect(chart.margin.right).toBe(44)
      expect(r.x).toBe(400 - 18) // against the right edge, beyond the labels
      expect(chart.margin.top).toBe(36)
      expect(t.y).toBe(0)
    })
  })

  it('wait for an axis that is attached after the title', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxisTitle({ bus, axis: 'late', props: { text: 'later' } }).addToChart(chart)
    expect(chart.getSvg().querySelector('.d3pict-axis-title')).toBeNull()
    new D3PAxis({ bus, name: 'late', domain: new D3PAxisDomain({ bus, domain: [0, 1] }), position: 'left' }).addToChart(chart)
    await settle()
    expect(chart.getSvg().querySelector('.d3pict-axis-title')!.textContent).toBe('later')
  })

  it('titles the axes of a polar system too, against the disc', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PPolarSystem({ bus, name: 'polar' }).addToChart(chart)
    const angle = new D3PAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }), position: 'angle', props: { displayName: 'direction' } })
    const radius = new D3PAxis({ bus, name: 'radius', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'radius', props: { displayName: 'power' } })
    angle.addToChart(chart)
    radius.addToChart(chart)
    new D3PAxisTitle({ bus, axis: angle }).addToChart(chart)
    new D3PAxisTitle({ bus, axis: radius }).addToChart(chart)
    await settle()
    const titles = [...chart.getSvg().querySelectorAll<HTMLElement>('.d3pict-axis-title')]
    expect(titles.map((t) => t.textContent)).toEqual(['direction', 'power'])
    expect(titles[0].style.writingMode).toBe('horizontal-tb') // under the disc
    expect(titles[1].style.writingMode).toBe('vertical-rl') // on its left
    // the plot is 320x240, the disc of radius 92 (28 of room for its labels) centered at (160, 120) in it
    const [under, left] = titles.map((t) => t.closest('foreignObject')!)
    expect([+under.getAttribute('x')!, +under.getAttribute('y')!, +under.getAttribute('width')!]).toEqual([60 + 160 - 92, 20 + 120 + 92 + 28 + 6, 184])
    expect([+left.getAttribute('x')!, +left.getAttribute('height')!]).toEqual([60 + 160 - 92 - 28 - 6 - 18, 184])
    expect(chart.margin.bottom).toBe(40) // it hangs from the plot into the margin: nothing to ask for
  })

  it('asks the plot for room when the disc fills it', async () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus, margin: { bottom: 0, left: 0, top: 0, right: 0 } })
    new D3PPolarSystem({ bus, name: 'polar' }).addToChart(chart)
    const angle = new D3PAxis({ bus, name: 'angle', domain: new D3PAxisDomain({ bus, domain: [0, 360] }), position: 'angle' })
    angle.addToChart(chart)
    new D3PAxisTitle({ bus, axis: angle }).addToChart(chart)
    await settle()
    await wait()
    expect(chart.margin.bottom).toBe(6 + 18) // the gap and the title, under the labels of the disc
  })
})

describe('the standard legend', () => {
  function lines(chart: D3PChart) {
    const a = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'a', data: [[0, 1], [1, 2]] }), props: { style: { color: '#e15759' } } })
    const b = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'b', data: [[0, 2], [1, 1]] }), props: { style: { color: '#4e79a7' } } })
    a.addToChart(chart)
    b.addToChart(chart)
    return { a, b }
  }

  it('lists the renderers under the plot, and a click hides one', async () => {
    const { chart } = chartWithAxes()
    const { a } = lines(chart)
    new D3PLegendPanel({ bus }).addToChart(chart)
    await settle()
    const entries = [...chart.getSvg().querySelectorAll<HTMLElement>('.d3pict-legend-entry')]
    expect(entries.map((e) => e.textContent)).toEqual(['a', 'b'])
    expect(chart.margin.bottom).toBe(40 + 28)
    entries[0].click()
    await settle()
    expect(a.visible).toBe(false)
    expect((chart.getSvg().querySelector('.d3pict-legend-entry') as HTMLElement).style.opacity).toBe('0.4')
  })

  it('goes on a side, or in a corner of the plot where it takes no room', async () => {
    const { chart } = chartWithAxes()
    lines(chart)
    new D3PLegendPanel({ bus, placement: 'right' }).addToChart(chart)
    expect(chart.margin.right).toBe(20 + 140)
    const corner = new D3PLegendPanel({ bus, placement: 'top-left' })
    const before = chart.margin.top
    corner.addToChart(chart)
    await settle()
    expect(chart.margin.top).toBe(before)
    const list = [...chart.getSvg().querySelectorAll<HTMLElement>('.d3pict-legend')].pop()!
    expect(list.style.position).toBe('absolute')
    expect(list.style.top).toBe('4px')
    expect(list.style.left).toBe('4px')
  })

  it('can be limited to some renderers', async () => {
    const { chart } = chartWithAxes()
    const { b } = lines(chart)
    new D3PLegendPanel({ bus, series: [b] }).addToChart(chart)
    await settle()
    expect([...chart.getSvg().querySelectorAll('.d3pict-legend-entry')].map((e) => e.textContent)).toEqual(['b'])
  })
})

describe('a component of your own', () => {
  // the example of the layout guide
  class Caption extends D3PAttachable<{}> {
    private readonly slot = new D3PSlot({ side: 'top', size: 24 })
    constructor(readonly text: string) {
      super('caption', [])
    }
    protected createData() {
      return {}
    }
    protected attached(chart: D3PChart) {
      this.slot.addToChart(chart)
      this.slot.getContainer(chart)!.textContent = this.text
    }
    protected override detached(chart: D3PChart) {
      this.slot.removeFromChart(chart)
    }
  }

  it('reserves its room and draws in it with the same pieces as the standard ones', () => {
    const chart = new D3PChart({ container: el, width: 400, height: 300 })
    const caption = new Caption('Source: monitoring')
    caption.addToChart(chart)
    expect(chart.margin.top).toBe(20 + 24)
    expect(chart.getSvg().querySelector('foreignObject div')!.textContent).toBe('Source: monitoring')
    caption.removeFromChart(chart)
    expect(chart.margin.top).toBe(20)
  })
})

describe('a legend with many entries', () => {
  function many(n: number, chart: D3PChart) {
    for (let i = 0; i < n; i++) new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: `server ${i}`, data: [[0, i], [1, i + 1]] }) }).addToChart(chart)
  }
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
  // nothing is laid out in jsdom: say how high the wrapped list would be
  const height = (px: number) => Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => px })
  afterEach(() => (descriptor ? Object.defineProperty(HTMLElement.prototype, 'scrollHeight', descriptor) : delete (HTMLElement.prototype as any).scrollHeight))

  it('gets as many lines as it needs under the plot, up to a third of the chart', async () => {
    const { chart } = chartWithAxes()
    many(32, chart)
    height(90) // four lines
    new D3PLegendPanel({ bus }).addToChart(chart)
    await settle()
    expect(chart.getSvg().querySelectorAll('.d3pict-legend-entry').length).toBe(32)
    expect(chart.margin.bottom).toBe(40 + 98) // the list and a little air
    height(900) // far more than fits
    chart.resize(400, 300)
    await settle()
    expect(chart.margin.bottom).toBe(40 + 100) // a third of the chart: the list scrolls in it
    const list = chart.getSvg().querySelector<HTMLElement>('.d3pict-legend')!
    expect(list.style.overflowY).toBe('auto')
    expect(list.style.maxHeight).toBe('100%')
  })

  it('keeps the size it was given', async () => {
    const { chart } = chartWithAxes()
    many(32, chart)
    height(90)
    new D3PLegendPanel({ bus, size: 40 }).addToChart(chart)
    await settle()
    expect(chart.margin.bottom).toBe(40 + 40)
  })

  it('cuts a long label and shows it whole as a title', async () => {
    const { chart } = chartWithAxes()
    new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: 'a very long name that does not fit in the strip', data: [[0, 1], [1, 2]] }) }).addToChart(chart)
    new D3PLegendPanel({ bus, placement: 'right' }).addToChart(chart)
    await settle()
    const entry = chart.getSvg().querySelector<HTMLElement>('.d3pict-legend-entry')!
    expect(entry.title).toBe('a very long name that does not fit in the strip')
    expect((entry.querySelector('span:last-child') as HTMLElement).style.textOverflow).toBe('ellipsis')
  })
})

describe('a tooltip with many entries', () => {
  it('goes in columns, a dozen lines each', async () => {
    const { chart } = chartWithAxes()
    const tooltip = new D3PTooltip({ bus })
    tooltip.addToChart(chart)
    d3pDomTooltip(tooltip)
    const renderers = Array.from({ length: 30 }, (_, i) => {
      const r = new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name: `s${i}`, data: [[0, i], [10, i]] }) })
      r.addToChart(chart)
      return r
    })
    const fake = (n: number) => ({ x: 10, y: 10, xSide: 'right' as const, ySide: 'bottom' as const, series: renderers.slice(0, n).map((renderer) => ({ renderer, x: 0, y: 1, xFormatter: String, yFormatter: String, color: '#000' })) })
    chart.emitEvent('tooltipShow', fake(30))
    await settle()
    const box = () => chart.getSvg().querySelector<HTMLElement>('.d3pict-tooltip')!
    expect(box().style.columnCount).toBe('3')
    chart.emitEvent('tooltipShow', fake(5))
    await settle()
    expect(box().style.columnCount).toBe('1')
  })
})
