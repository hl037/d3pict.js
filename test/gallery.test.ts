import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { D3PBus, D3PChart, d3pAutoInteractionArea, d3pSettle } from '../src'
import { GALLERY } from '../examples/scenarios/gallery'
import { pointer } from './helpers'

let el: HTMLElement
beforeEach(() => {
  el = document.createElement('div')
  document.body.append(el)
})
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('every chart of the gallery', () => {
  it('has unique ids', () => {
    expect(new Set(GALLERY.map((g) => g.id)).size).toBe(GALLERY.length)
  })

  it.each(GALLERY.map((g) => [g.id, g] as const))('%s draws, answers the pointer, and tears down without errors', async (_id, entry) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = new D3PBus()
    const scene = entry.build(bus)
    const chart = new D3PChart({ container: el, bus, width: 640, height: 420, margin: scene.margin })
    const disposeArea = d3pAutoInteractionArea(chart)
    scene.objects.forEach((o) => o.addToChart(chart))
    await d3pSettle(bus)
    await wait(300)

    // something was drawn by the renderers
    const marks = el.querySelectorAll('.series-renderer path, .series-renderer rect, .series-renderer circle, .series-renderer g.glyph, .series-renderer line, .series-renderer polygon')
    expect(marks.length, 'drawn marks').toBeGreaterThan(0)

    // hover over the middle of the chart (tooltip, cursor, hover effects)
    const [cx, cy] = [chart.innerWidth / 2, chart.innerHeight / 2]
    chart.emitEvent('mousemove', pointer(chart, cx, cy, 'mousemove'))
    await d3pSettle(bus)
    await wait(150)
    chart.emitEvent('mouseleave', pointer(chart, cx, cy, 'mouseleave'))
    await d3pSettle(bus)

    // a legend, when the scene has one, lists something
    if (scene.legend) {
      expect(scene.legend.container.getData(chart)?.series.length ?? 0).toBeGreaterThan(0)
    }
    disposeArea()
    chart.destroy()
    scene.destroy()
    await d3pSettle(bus)
    const messages = errors.mock.calls.map((c) => String((c[1] as Error)?.message ?? c[0]))
    expect(messages).toEqual([])
  })
})
