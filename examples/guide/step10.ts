import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PCursorIndicator, D3PLegendPanel, D3PLineRenderer, D3PPanTool, D3PResetTool, D3PSeries, D3PTitle, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus, type D3PPoint,
} from '../../src'
import { destroyAll } from '../scenarios/destroy'

/** Step 10 of the guide: changing the data. */
export function createStep10(bus: D3PBus) {
  // #region chart
  const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })
  const feelsLike = new D3PSeries({ bus, name: 'feels like', data: [[0, 10], [4, 6], [8, 12], [12, 22], [16, 25], [20, 15], [24, 11]] })

  const hours = new D3PAxisDomain({ bus, domain: [0, 24] })
  const degrees = new D3PAxisDomain({ bus, domain: [0, 30] })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(temperature, [hours, degrees])
  auto.linkSeries(feelsLike, [hours, degrees])

  // the same domains on polar axes: the hour is an angle, the temperature a distance from the center
  const x = new D3PAxis({ bus, name: 'hour', domain: hours, position: 'angle', props: { tickCount: 6, tickFormat: (v) => `${Math.round(v)} h`, grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'temperature', domain: degrees, position: 'radius', props: { tickFormat: (v) => `${Math.round(v * 10) / 10} °C`, grid: { enabled: true } } })
  // one renderer per series; its style is a prop
  const line = new D3PLineRenderer({ bus, series: temperature, props: { style: { color: '#e15759', curve: 'monotone', strokeWidth: 2.5 } } })
  const feelsLine = new D3PLineRenderer({ bus, series: feelsLike, props: { style: { color: '#4e79a7', curve: 'monotone' } } })

  // what the pointer shows: a crosshair and a tooltip
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })

  // tools act on the domains: drag to pan, wheel to zoom
  const tools = new D3PToolbox({ bus })
  tools.addTool(new D3PPanTool({ bus }))
  tools.addTool(new D3PWheelZoomTool({ bus }))
  tools.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) tools.setToolActive(name)

  // titles and a legend take their room from the plot
  const title = new D3PTitle({ bus, props: { text: 'Temperature', subtitle: 'on 12 June' } })
  const xTitle = new D3PAxisTitle({ bus, axis: x, props: { text: 'hour of the day' } })
  const yTitle = new D3PAxisTitle({ bus, axis: y, props: { text: 'temperature' } })
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

  // changing the data is assigning the series: the lines move from what was there to what is there now, and the domains fit it
  const next = (series: D3PSeries): D3PPoint => {
    const last = series.data[series.data.length - 1]
    return [+last[0] + 4, Math.round(Math.min(30, Math.max(0, last[1] + (Math.random() - 0.5) * 10)))]
  }
  const both = [temperature, feelsLike]
  const actions: Record<string, () => void> = {
    'add a point': () => both.forEach((series) => (series.data = [...series.data, next(series)])),
    'remove the last': () => both.forEach((series) => series.data.length > 2 && (series.data = series.data.slice(0, -1))),
    'remove the first': () => both.forEach((series) => series.data.length > 2 && (series.data = series.data.slice(1))),
    replace: () => both.forEach((series) => (series.data = Array.from({ length: 5 + Math.floor(Math.random() * 5) }, (_, i) => [i * 4, Math.round(5 + Math.random() * 22)]))),
  }

  const objects = [x, y, line, feelsLine, cursor, tooltip, tools, title, xTitle, yTitle, legendPanel]
  // #endregion chart
  return { objects, tooltip, actions, destroy: () => destroyAll([temperature, feelsLike, hours, degrees, auto, x, y, line, feelsLine, cursor, tooltip, tools, title, xTitle, yTitle, legendPanel]) }
}
export type Step10 = ReturnType<typeof createStep10>
