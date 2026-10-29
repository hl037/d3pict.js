// @vitest-environment jsdom
import { createElement, StrictMode, act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createApp, defineComponent, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import * as library from '../src'
import { D3PBus, D3PChart, D3PSeries, d3pContext, type D3PContext } from '../src'
import { useD3PContext as useVueContext, D3PVPlugin } from '../src/vue'
import { useD3PContext as useReactContext, D3PRProvider } from '../src/react'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => (document.body.innerHTML = ''))

describe('d3pContext', () => {
  it('makes the objects of the library with its bus, like `new` does', () => {
    const bus = new D3PBus()
    const ctx = d3pContext(bus)
    const series = ctx.newSeries({ name: 's', data: [[0, 1], [1, 2]] })
    const domain = ctx.newAxisDomain({ domain: [0, 1] })
    const axis = ctx.newAxis({ name: 'x', domain })
    const line = ctx.newLineRenderer({ series })
    expect(series).toBeInstanceOf(D3PSeries)
    expect(series.bus).toBe(bus)
    expect(domain.bus).toBe(bus)
    expect(axis.bus).toBe(bus)
    expect(line.bus).toBe(bus)
    expect(ctx.bus).toBe(bus)
    // the options that are not required can be left out
    expect(ctx.newCursorIndicator().bus).toBe(bus)
    expect(ctx.newToolbox().bus).toBe(bus)
  })

  it('has a `newXXX` for every class that is made from options with a bus, and none for the others', () => {
    const ctx = d3pContext(new D3PBus())
    const names = Object.keys(ctx).filter((k) => k.startsWith('new'))
    expect(names.length).toBeGreaterThan(40)
    for (const name of names) expect(typeof (library as any)[`D3P${name.slice(3)}`], `D3P${name.slice(3)}`).toBe('function')
    // what is made from the options and the bus, in the library, has its method
    const missing = Object.entries(library)
      .filter(([name, value]) => /^D3P[A-Z]/.test(name) && typeof value === 'function' && value.prototype && 'destroy' in value.prototype)
      .map(([name]) => `new${name.slice(3)}`)
      .filter((method) => !names.includes(method))
    // base classes, the managers a chart owns and the objects that are not made from options
    expect(missing.sort()).toMatchInlineSnapshot(`
      [
        "newAttachable",
        "newAxisManager",
        "newCoordinateSystem",
        "newCoordinates",
        "newGlyphRenderer",
        "newHtmlContainer",
        "newLayout",
        "newObject",
        "newPathRenderer",
        "newProbe",
        "newRenderManager",
        "newSeriesRenderer",
        "newSeriesRendererManager",
        "newTool",
        "newZoomTool",
      ]
    `)
  })

  it('destroys what it made, the last one first, and what it was given', () => {
    const ctx = d3pContext(new D3PBus())
    const order: string[] = []
    const track = <T extends { destroy(): void }>(name: string, object: T): T => {
      const destroy = object.destroy.bind(object)
      object.destroy = () => (order.push(name), destroy())
      return object
    }
    const series = track('series', ctx.newSeries({ name: 's', data: [[0, 1]] }))
    const line = track('line', ctx.newLineRenderer({ series }))
    const mine = new D3PSeries({ name: 'mine', data: [] })
    ctx.destroyLater(mine)
    ctx.destroy()
    expect(order).toEqual(['line', 'series'])
    expect(mine.isDestroying).toBe(true)
    expect(line.isDestroying).toBe(true)
    ctx.destroy() // nothing left: no error
  })

  it('can be used again after `destroy`', () => {
    const ctx = d3pContext(new D3PBus())
    const first = ctx.newSeries({ name: 'a', data: [] })
    ctx.destroy()
    const second = ctx.newSeries({ name: 'b', data: [] })
    expect(first.isDestroying).toBe(true)
    expect(second.isDestroying).toBe(false)
    ctx.destroy()
    expect(second.isDestroying).toBe(true)
  })

  it('keeps going when an object fails to be destroyed', () => {
    const ctx = d3pContext(new D3PBus())
    const fine = ctx.newSeries({ name: 'fine', data: [] })
    ctx.destroyLater({ destroy: () => { throw new Error('boom') } })
    const log = console.error
    console.error = () => {}
    try {
      ctx.destroy()
    } finally {
      console.error = log
    }
    expect(fine.isDestroying).toBe(true)
  })

  it('attaches what it made to a chart like what `new` makes', async () => {
    const bus = new D3PBus()
    const ctx = d3pContext(bus)
    const el = document.createElement('div')
    document.body.append(el)
    const chart = ctx.newChart({ container: el, width: 300, height: 200 })
    expect(chart).toBeInstanceOf(D3PChart)
    const series = ctx.newSeries({ name: 's', data: [[0, 0], [1, 1]] })
    const x = ctx.newAxis({ name: 'x', domain: ctx.newAxisDomain({ domain: [0, 1] }) })
    const y = ctx.newAxis({ name: 'y', domain: ctx.newAxisDomain({ domain: [0, 1] }), position: 'left' })
    for (const o of [x, y, ctx.newLineRenderer({ series })]) o.addToChart(chart)
    await library.d3pSettle(bus)
    expect(el.querySelectorAll('path.line')).toHaveLength(1)
    ctx.destroy()
    await library.d3pSettle(bus)
    expect(el.querySelectorAll('path.line')).toHaveLength(0)
  })

  it('checks the options like the constructors do', () => {
    const ctx: D3PContext = d3pContext(new D3PBus())
    // @ts-expect-error a series needs a name
    expect(() => ctx.newSeries({ data: [] })).not.toThrow()
    // @ts-expect-error an axis needs a domain and a name
    expect(() => ctx.newAxis({})).toThrow()
    // @ts-expect-error the bus is the context's
    ctx.newSeries({ name: 's', data: [], bus: new D3PBus() })
  })
})

describe('useD3PContext in Vue', () => {
  it('destroys what it made when the component goes away', () => {
    const el = document.createElement('div')
    document.body.append(el)
    let series!: D3PSeries
    let mine!: D3PSeries
    const Comp = defineComponent({
      setup() {
        const ctx = useVueContext()
        series = ctx.newSeries({ name: 's', data: [[0, 1]] })
        mine = ctx.destroyLater(new D3PSeries({ bus: ctx.bus, name: 'mine', data: [] }))
        return () => h('div', 'chart')
      },
    })
    const app = createApp(Comp).use(D3PVPlugin)
    app.mount(el)
    expect(series.isDestroying).toBe(false)
    app.unmount()
    expect(series.isDestroying).toBe(true)
    expect(mine.isDestroying).toBe(true)
  })

  it('uses the bus of the app, not the global one', () => {
    const el = document.createElement('div')
    document.body.append(el)
    let bus: unknown
    const Comp = defineComponent({
      setup() {
        bus = useVueContext().bus
        return () => h('div')
      },
    })
    createApp(Comp).use(D3PVPlugin).mount(el)
    expect(bus).toBeInstanceOf(D3PBus)
    expect(bus).not.toBe(library.getGlobalBus())
  })
})

describe('useD3PContext in React', () => {
  it('destroys what it made when the component goes away, and keeps working under StrictMode', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const made: D3PSeries[] = []
    let current: D3PSeries | undefined
    function Comp() {
      const ctx = useReactContext()
      const [series, setSeries] = useState<D3PSeries>()
      useEffect(() => {
        const created = ctx.newSeries({ name: 's', data: [[0, 1]] })
        made.push(created)
        setSeries(created)
      }, [ctx])
      current = series
      return createElement('div', null, series ? 'ready' : 'waiting')
    }
    const root = createRoot(el)
    await act(async () => root.render(createElement(StrictMode, null, createElement(D3PRProvider, { bus: new D3PBus() }, createElement(Comp)))))
    // mount, unmount and mount again: the first series was destroyed by the first unmount, the last one is alive
    expect(made.length).toBe(2)
    expect(made[0].isDestroying).toBe(true)
    expect(made[1].isDestroying).toBe(false)
    expect(current).toBe(made[1])
    expect(el.textContent).toBe('ready')
    await act(async () => root.unmount())
    expect(made[1].isDestroying).toBe(true)
  })

  it('uses the bus of the provider', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    const bus = new D3PBus()
    let seen: unknown
    function Comp() {
      seen = useReactContext().bus
      return null
    }
    const root = createRoot(el)
    await act(async () => root.render(createElement(D3PRProvider, { bus }, createElement(Comp))))
    expect(seen).toBe(bus)
    await act(async () => root.unmount())
  })
})
