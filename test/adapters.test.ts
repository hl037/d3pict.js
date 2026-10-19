import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import {
  getGlobalBus, D3PAnchor, D3PAxis, D3PAxisDomain, D3PBus, D3PLegendBundle, D3PLineRenderer, D3PPanTool, D3PSeries, D3PTooltip, d3pSettle,
} from '../src'
import { D3PVAnchor as VAnchor, D3PVChart as VChart, D3PVLegend as VLegend, D3PVPlugin, useD3PBus, D3PVTooltip as VTooltip } from '../src/vue'
import { D3PRAnchor as RAnchor, D3PRChart as RChart, D3PRLegend as RLegend, D3PRProvider } from '../src/react'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false

function objects(bus: D3PBus) {
  const dx = new D3PAxisDomain({ bus, domain: [0, 10] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const series = new D3PSeries({ bus, name: 's', data: [[0, 0], [10, 100]] })
  return {
    ax: new D3PAxis({ bus, name: 'x', domain: dx }),
    ay: new D3PAxis({ bus, name: 'y', domain: dy, position: 'left' }),
    line: new D3PLineRenderer({ bus, series }),
    pan: new D3PPanTool({ bus }),
    legend: new D3PLegendBundle({ bus }),
    anchor: new D3PAnchor({ bus }),
    tooltip: new D3PTooltip({ bus }),
  }
}

afterEach(() => (document.body.innerHTML = ''))

describe('Vue adapter', () => {
  it('creates the chart, syncs objects, creates the interaction area on demand and tears down', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const bus = new D3PBus()
    const o = objects(bus)
    let list: any[] = [o.ax, o.ay, o.line]
    let chartRef: any
    let busSeen: D3PBus | undefined
    const Probe = { setup() { busSeen = useD3PBus(); return () => null } }
    const app = createApp({
      data: () => ({ list }),
      render() {
        return h('div', [
          h(VChart, { width: 400, height: 300, objects: this.list, bus, onReady: (c: any) => (chartRef = c) }),
          h(VLegend, { legend: o.legend }),
          h(VTooltip, { tooltip: o.tooltip }),
          h(VAnchor, { anchor: o.anchor, x: 5 }, { default: () => 'hello' }),
          h(Probe),
        ])
      },
    })
    app.use(D3PVPlugin)
    const vm: any = app.mount(el)
    await nextTick()
    expect(chartRef).toBeTruthy()
    expect(busSeen).toBeDefined() // plugin-provided bus
    await d3pSettle(bus)
    expect(el.querySelector('.x-axis-x')).toBeTruthy()

    o.legend.addToChart(chartRef)
    o.anchor.addToChart(chartRef)
    await d3pSettle(bus)
    await nextTick()
    expect(el.textContent).toContain('s') // legend entry teleported into the chart
    expect(el.textContent).toContain('hello')

    // a tool asking for an area makes the component create one
    expect(el.querySelector('rect.interaction-area')).toBeNull()
    vm.list = [o.ax, o.ay, o.line, o.pan]
    await nextTick()
    await d3pSettle(bus)
    expect(el.querySelectorAll('rect.interaction-area').length).toBe(1)

    // removing an object from the list detaches it
    vm.list = [o.ax, o.ay]
    await nextTick()
    expect(o.line.hasChart(chartRef)).toBe(false)

    app.unmount()
    expect(el.querySelector('svg')).toBeNull()
  })
})

describe('Vue views follow their prop', () => {
  it('shows the legend and the tooltip of a replacement object, not the first one', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const bus = new D3PBus()
    const make = (name: string) => {
      const dx = new D3PAxisDomain({ bus, domain: [0, 1] })
      const dy = new D3PAxisDomain({ bus, domain: [0, 1] })
      return {
        objects: [
          new D3PAxis({ bus, name: 'x', domain: dx }),
          new D3PAxis({ bus, name: 'y', domain: dy, position: 'left' }),
          new D3PLineRenderer({ bus, series: new D3PSeries({ bus, name, data: [[0, 0], [1, 1]] }) }),
        ],
        legend: new D3PLegendBundle({ bus }),
      }
    }
    const a = make('alpha')
    const b = make('beta')
    const app = createApp({
      data: () => ({ scene: a }),
      render() {
        const scene = (this as any).scene
        // the chart is made again for each scene, as an application switching charts would
        return h('div', [
          h(VChart, { key: scene === a ? 'a' : 'b', width: 400, height: 300, objects: [...scene.objects, scene.legend], bus }),
          h(VLegend, { legend: scene.legend }), // the same component instance, a new prop
        ])
      },
    })
    app.use(D3PVPlugin)
    const vm: any = app.mount(el)
    await nextTick()
    await d3pSettle(bus)
    await nextTick()
    expect(el.textContent).toContain('alpha')
    vm.scene = b
    await nextTick()
    await d3pSettle(bus)
    await nextTick()
    expect(el.textContent).toContain('beta')
    expect(el.textContent).not.toContain('alpha')
    app.unmount()
  })
})

describe('React adapter', () => {
  it('creates the chart, syncs objects, portals content and tears down', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const bus = new D3PBus()
    const o = objects(bus)
    let chart: any
    const root = createRoot(el)
    const render = (list: any[]) =>
      flushSync(() =>
        root.render(
          createElement(D3PRProvider, { bus }, [
            createElement(RChart, { key: 'c', width: 400, height: 300, objects: list, onReady: (c) => (chart = c) }),
            createElement(RLegend, { key: 'l', legend: o.legend }),
            createElement(RAnchor, { key: 'a', anchor: o.anchor }, ),
          ]),
        ),
      )
    render([o.ax, o.ay, o.line])
    await d3pSettle(bus)
    expect(chart).toBeTruthy()
    expect(el.querySelector('.x-axis-x')).toBeTruthy()

    o.legend.addToChart(chart)
    o.anchor.addToChart(chart)
    await d3pSettle(bus)
    await new Promise((r) => setTimeout(r, 20))
    expect(el.textContent).toContain('s')

    render([o.ax, o.ay, o.line, o.pan])
    await d3pSettle(bus)
    expect(el.querySelectorAll('rect.interaction-area').length).toBe(1)

    render([o.ax, o.ay])
    expect(o.line.hasChart(chart)).toBe(false)

    flushSync(() => root.unmount())
    expect(el.querySelector('svg')).toBeNull()
  })
})

describe('Vue plugin and the global bus', () => {
  it('leaves getGlobalBus() usable outside components after installation', () => {
    createApp({ render: () => null }).use(D3PVPlugin)
    expect(getGlobalBus()).toBeInstanceOf(D3PBus)
  })
})
