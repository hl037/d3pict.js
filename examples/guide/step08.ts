import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PBarRenderer, D3PCursorIndicator, D3PLegendPanel, D3PLineRenderer, D3PPanTool, D3PResetTool, D3PSeries, D3PTitle, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { destroyAll } from '../scenarios/destroy'

/** Step 8 of the guide: other kinds. */
export function createStep08(bus: D3PBus) {
  // #region chart
  const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })
  const feelsLike = new D3PSeries({ bus, name: 'feels like', data: [[0, 10], [4, 6], [8, 12], [12, 22], [16, 25], [20, 15], [24, 11]] })
  const humidity = new D3PSeries({ bus, name: 'humidity', data: [[0, 80], [4, 85], [8, 70], [12, 45], [16, 40], [20, 60], [24, 75]] })

  const hours = new D3PAxisDomain({ bus, domain: [0, 24] })
  const degrees = new D3PAxisDomain({ bus, domain: [0, 30] })
  const percent = new D3PAxisDomain({ bus, domain: [0, 100] })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(temperature, [hours, degrees])
  auto.linkSeries(feelsLike, [hours, degrees])

  const x = new D3PAxis({ bus, name: 'hour', domain: hours, props: { tickCount: 6, tickFormat: (v) => `${Math.round(v)} h`, grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'temperature', domain: degrees, position: 'left', props: { tickFormat: (v) => `${Math.round(v * 10) / 10} °C`, grid: { enabled: true } } })
  // a second Y axis, on the right, for a quantity in other units
  const yRight = new D3PAxis({ bus, name: 'humidity', domain: percent, position: 'right', props: { tickFormat: (v) => `${Math.round(v)} %` } })
  // one renderer per series; its style is a prop
  const line = new D3PLineRenderer({ bus, series: temperature, props: { style: { color: '#e15759', curve: 'monotone', strokeWidth: 2.5 } } })
  // the same series, drawn as bars; a renderer is the only thing that changes
  const humidityBars = new D3PBarRenderer({ bus, series: humidity, axes: ['hour', 'humidity'], props: { style: { color: '#9ccc96', barWidth: 14 } } })
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
  const yRightTitle = new D3PAxisTitle({ bus, axis: yRight, props: { text: 'humidity' } })
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

  const objects = [x, y, yRight, humidityBars, line, feelsLine, cursor, tooltip, tools, title, xTitle, yTitle, yRightTitle, legendPanel]
  // #endregion chart
  return { objects, tooltip, destroy: () => destroyAll([temperature, feelsLike, humidity, hours, degrees, percent, auto, x, y, yRight, line, humidityBars, feelsLine, cursor, tooltip, tools, title, xTitle, yTitle, yRightTitle, legendPanel]) }
}
export type Step08 = ReturnType<typeof createStep08>
