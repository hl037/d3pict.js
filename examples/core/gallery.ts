import { D3PChart, d3pAutoInteractionArea, getGlobalBus, d3pDomTooltip, d3pDomLegend } from '../../src'
import { GALLERY, type GalleryScene } from '../scenarios/gallery'
import { t, type MessageKey } from '../shared/i18n'

const GROUPS = ['cartesian', 'polar', 'noaxes'] as const

/** Core only: a list of chart types, and a chart rebuilt from the chosen scene. */
export function mount(root: HTMLElement) {
  const bus = getGlobalBus()

  const select = document.createElement('select')
  select.className = 'type-select'
  for (const group of GROUPS) {
    const og = Object.assign(document.createElement('optgroup'), { label: t(`group.${group}` as MessageKey) })
    for (const entry of GALLERY.filter((g) => g.group === group)) og.append(Object.assign(document.createElement('option'), { value: entry.id, textContent: t(`type.${entry.id}` as MessageKey) }))
    select.append(og)
  }
  const bar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  bar.append(select)
  const host = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(bar, host)

  let current: { chart: D3PChart; scene: GalleryScene; stop: () => void } | undefined
  function show(id: string) {
    current?.stop()
    const entry = GALLERY.find((g) => g.id === id)!
    const scene = entry.build(bus)
    const chart = new D3PChart({ container: host, bus, margin: scene.margin })
    const disposeArea = d3pAutoInteractionArea(chart) // before the objects: cursor and tooltip ask for an area
    scene.objects.forEach((o) => o.addToChart(chart))
    const offs = [scene.tooltip && d3pDomTooltip(scene.tooltip), scene.legend && d3pDomLegend(scene.legend)]
    current = {
      chart,
      scene,
      stop: () => {
        offs.forEach((o) => o?.())
        disposeArea()
        chart.destroy()
        scene.destroy()
      },
    }
  }
  select.onchange = () => show(select.value)
  show(select.value)

  return () => {
    current?.stop()
    bar.remove()
    host.remove()
  }
}
