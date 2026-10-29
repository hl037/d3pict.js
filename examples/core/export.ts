import { D3PChart, d3pAutoInteractionArea, d3pDomTooltip, getGlobalBus } from 'd3pict'
import { createExportScenario } from '../scenarios/export'

export function mount(root: HTMLElement) {
  const bus = getGlobalBus()
  const scenario = createExportScenario(bus)
  const { objects, tooltip, fileName } = scenario
  const container = Object.assign(document.createElement('div'), { className: 'chart-host' })
  root.append(container)

  // #region mount
  const chart = new D3PChart({ container, bus })
  const stopArea = d3pAutoInteractionArea(chart) // before the objects: the cursor and the tooltip ask for an interaction area
  objects.forEach((o) => o.addToChart(chart))
  const stopTooltip = d3pDomTooltip(tooltip)

  // the options of an export: the colors of the page are not the ones of the file
  const themes = { light: {}, dark: { background: '#111827', color: '#e5e7eb' }, transparent: { background: null } }
  let theme: keyof typeof themes = 'light'
  let scale = 2
  const options = () => ({ ...themes[theme], scale })

  // a preview: the PNG that would be saved, as an image under the chart
  const preview = Object.assign(document.createElement('img'), { alt: 'preview of the PNG', hidden: true })
  preview.style.cssText = 'align-self: flex-start; max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #ccc; background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px'
  container.after(preview)

  // the controls: save an SVG, save a PNG, preview it, and the options of the export
  const toolbar = Object.assign(document.createElement('div'), { className: 'toolbar' })
  container.before(toolbar)
  const button = (label: string, run: () => void) => Object.assign(document.createElement('button'), { textContent: label, onclick: run })
  const select = (title: string, choices: Record<string, string>, selected: string, change: (value: string) => void) => {
    const element = Object.assign(document.createElement('select'), { title, onchange: () => change(element.value) })
    for (const [value, label] of Object.entries(choices)) element.append(Object.assign(document.createElement('option'), { value, textContent: label }))
    element.value = selected
    return element
  }
  toolbar.append(
    button('save SVG', () => chart.downloadSVG(`${fileName}.svg`, options())),
    button('save PNG', () => chart.downloadPNG(`${fileName}.png`, options())),
    button('preview', async () => {
      preview.src = await chart.exportPNG(options())
      preview.hidden = false
    }),
    select('background', { light: 'light', dark: 'dark', transparent: 'transparent' }, theme, (value) => (theme = value as typeof theme)),
    select('PNG scale', { 1: '1×', 2: '2×', 4: '4×' }, String(scale), (value) => (scale = +value)),
  )
  // #endregion mount

  return () => {
    stopTooltip()
    stopArea()
    chart.destroy()
    scenario.destroy()
    toolbar.remove()
    preview.remove()
    container.remove()
  }
}
