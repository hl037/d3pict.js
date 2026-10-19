import type { D3PChart } from './chart'
import type { D3PHtmlContainer } from './html'
import type { D3PLegend, D3PLegendBundle } from './legend'
import { d3pTooltipText, type D3PTooltip, type D3PTooltipData } from './tooltip'

type Off = () => void

/** Lines of a tooltip before it starts a new column. */
const TOOLTIP_COLUMN_LINES = 12

/** Run `subscribe` once per chart attached to `container`, and clean up when the chart leaves. */
function perChart<D>(container: D3PHtmlContainer<D>, subscribe: (chart: D3PChart, el: HTMLElement, current: D | undefined) => Off[]): Off {
  const subs = new Map<D3PChart, Off[]>()
  const sync = () => {
    const live = container.getContainers()
    for (const [chart, offs] of subs) {
      if (!live.some((c) => c.chart === chart)) (offs.forEach((o) => o()), subs.delete(chart))
    }
    for (const { chart, container: el, data } of live) if (!subs.has(chart)) subs.set(chart, subscribe(chart, el, data))
  }
  const off = container.bus.on(container.e.changed, sync)
  sync()
  return () => {
    off()
    for (const offs of subs.values()) offs.forEach((o) => o())
    subs.clear()
  }
}

function dot(color: string, size: number, round: boolean): HTMLSpanElement {
  const span = document.createElement('span')
  Object.assign(span.style, { display: 'inline-block', width: `${size}px`, height: `${size}px`, borderRadius: round ? '50%' : '0', background: color, marginRight: '4px' })
  return span
}

/**
 * Fill the tooltip of `tooltip` with plain DOM content: a line per series, with its color and
 * text (`d3pTooltipText`). The core only gives the container; this is the same default content
 * as the Vue and React tooltips. To show something else, listen to `chart.event('tooltipShow')`
 * and `'tooltipHide'` yourself. Returns a function that stops it.
 */
export function d3pDomTooltip(tooltip: D3PTooltip): Off {
  const render = (host: HTMLElement, data: D3PTooltipData | undefined) => {
    host.replaceChildren()
    if (!data) return
    const box = document.createElement('div')
    box.className = 'd3pict-tooltip'
    box.style.cssText = 'background: #fff; color: #222; border: 1px solid #ccc; border-radius: 4px; padding: 4px 8px; font: 12px sans-serif; white-space: nowrap'
    // a long list goes in columns, so the box does not grow taller than the chart
    box.style.columnCount = String(Math.ceil(data.series.length / TOOLTIP_COLUMN_LINES))
    box.style.columnGap = '16px'
    for (const s of data.series) {
      const line = document.createElement('div')
      line.style.breakInside = 'avoid'
      line.append(dot(s.color, 8, true), d3pTooltipText(s))
      box.append(line)
    }
    host.append(box)
  }
  return perChart(tooltip.container, (chart, host, current) => {
    render(host, current)
    const bus = tooltip.manager.bus
    return [bus.on(chart.event('tooltipShow'), (d) => render(host, d)), bus.on(chart.event('tooltipHide'), () => render(host, undefined))]
  })
}

/**
 * Fill the legend of `legend` with plain DOM content, in the top right corner of the chart: a
 * line per entry, which a click shows or hides. The same default content as the Vue and React
 * legends. Returns a function that stops it.
 */
export function d3pDomLegend(legend: D3PLegendBundle): Off {
  const render = (host: HTMLElement, data: D3PLegend | undefined) => {
    host.replaceChildren()
    if (!data) return
    const box = document.createElement('div')
    box.style.cssText = 'position: absolute; top: 4px; right: 4px; max-height: calc(100% - 8px); overflow-y: auto; pointer-events: auto; font: 12px sans-serif'
    for (const s of data.series) {
      const line = document.createElement('div')
      line.style.cursor = 'pointer'
      line.style.opacity = s.visible ? '1' : '0.4'
      line.onclick = () => s.toggle()
      line.append(dot(s.color, 10, false), s.label)
      box.append(line)
    }
    host.append(box)
  }
  return perChart(legend.container, (chart, host, current) => {
    render(host, current)
    return [legend.manager.bus.on(chart.event('legendChanged'), (d) => render(host, d))]
  })
}
