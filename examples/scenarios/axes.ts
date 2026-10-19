import * as d3 from 'd3'
import {
  D3PAreaRenderer, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PCursorIndicator, D3PLegendPanel, D3PLineRenderer, D3PPanTool, D3PResetTool, D3PSeries,
  D3PTitle, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { walk } from '../shared/data'
import { destroyAll } from './destroy'

/**
 * One chart, four Y axes (two on each side, one of them logarithmic) and two X axes (time of the
 * day at the bottom, day at the top, one domain). Each series is drawn against its own axes, and
 * the axes are tinted like their series. Only the X axes zoom and pan; the Y axes keep their range.
 */
export function createAxesScenario(bus: D3PBus) {
  // #region chart
  const hours = 120
  const start = Date.UTC(2026, 0, 5)
  const hourly = (values: number[]): [Date, number][] => values.map((v, i) => [new Date(start + i * 3_600_000), v])
  const requests = new D3PSeries({ bus, name: 'requests', data: hourly(walk(21, hours, 800, 140, 100, 1500)) })
  const cpu = new D3PSeries({ bus, name: 'cpu', data: hourly(walk(22, hours, 45, 14, 5, 95)) })
  const latency = new D3PSeries({ bus, name: 'latency', data: hourly(walk(23, hours, 1.6, 0.5, 0.5, 3.3).map((v) => 10 ** v)) }) // 3 ms to 2 s
  const errors = new D3PSeries({ bus, name: 'errors', data: hourly(walk(24, hours, 2, 1.4, 0, 9)) })

  // one domain per axis: both X axes read the same one
  const time = new D3PAxisDomain({ bus, domain: [new Date(start), new Date(start + (hours - 1) * 3_600_000)] })
  const dRequests = new D3PAxisDomain({ bus, domain: [0, 1600] })
  const dCpu = new D3PAxisDomain({ bus, domain: [0, 100] })
  const dLatency = new D3PAxisDomain({ bus, domain: [3, 3000] })
  const dErrors = new D3PAxisDomain({ bus, domain: [0, 10] })

  const COLORS = { requests: '#4e79a7', cpu: '#f28e2b', latency: '#e15759', errors: '#59a14f' }
  // an axis takes the color of its series
  const tint = (color: string) => ({ postProcess: (g: d3.Selection<SVGGElement, unknown, null, undefined>) => void g.style('color', color) })

  const hour = new D3PAxis({ bus, name: 'hour', domain: time, scaleType: 'time', props: { tickFormat: d3.timeFormat('%H:%M'), grid: { enabled: true } } })
  const day = new D3PAxis({ bus, name: 'day', domain: time, scaleType: 'time', position: 'top', props: { tickFormat: d3.timeFormat('%a %d'), tickCount: 5 } })
  // two axes on the left and two on the right: `offset` moves the second one of each side away from the plot
  const yRequests = new D3PAxis({ bus, name: 'requests', domain: dRequests, position: 'left', props: { displayName: 'requests/h', ...tint(COLORS.requests), grid: { enabled: true } } })
  const yCpu = new D3PAxis({ bus, name: 'cpu', domain: dCpu, position: 'left', offset: 84, props: { displayName: 'cpu', tickFormat: (v) => `${Math.round(v)} %`, ...tint(COLORS.cpu) } })
  const yLatency = new D3PAxis({ bus, name: 'latency', domain: dLatency, position: 'right', scaleType: 'log', props: { displayName: 'latency', tickFormat: (v) => `${d3.format('.3~s')(v)} ms`, tickCount: 3, ...tint(COLORS.latency) } })
  const yErrors = new D3PAxis({ bus, name: 'errors', domain: dErrors, position: 'right', offset: 84, props: { displayName: 'errors', tickFormat: (v) => `${Math.round(v)} %`, ...tint(COLORS.errors) } })

  // a renderer names the axes it draws against
  const requestsLine = new D3PLineRenderer({ bus, series: requests, axes: ['hour', 'requests'], props: { style: { color: COLORS.requests } } })
  const cpuLine = new D3PLineRenderer({ bus, series: cpu, axes: ['hour', 'cpu'], props: { style: { color: COLORS.cpu, curve: 'monotone' } } })
  const latencyLine = new D3PLineRenderer({ bus, series: latency, axes: ['hour', 'latency'], props: { style: { color: COLORS.latency } } })
  const errorsArea = new D3PAreaRenderer({ bus, series: errors, axes: ['hour', 'errors'], props: { style: { color: COLORS.errors, opacity: 0.25 } } })

  const lines = [requestsLine, cpuLine, latencyLine, errorsArea]
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })
  // a title for each Y axis, in the color of its series, against its own labels: the second axis of a side
  // is placed far enough (`offset`) for the title of the first one to fit between the two
  const titles = ([['requests', COLORS.requests], ['cpu', COLORS.cpu], ['latency', COLORS.latency], ['errors', COLORS.errors]] as const).map(([name, color]) => new D3PAxisTitle({ bus, axis: name, props: { style: { color } } }))
  const title = new D3PTitle({ bus, props: { text: 'Service metrics' } })
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

  // the X axes only: both read the same domain, so the top one follows
  const toolbox = new D3PToolbox({ bus })
  toolbox.addTool(new D3PPanTool({ bus, axes: ['hour'] }))
  toolbox.addTool(new D3PWheelZoomTool({ bus, axes: ['hour'] }))
  toolbox.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)

  // the axes first, then what draws against them; the titles ask the chart for the room they need
  const objects = [hour, day, yRequests, yCpu, yLatency, yErrors, ...lines, ...titles, title, legendPanel, cursor, tooltip, toolbox]
  // #endregion chart

  const all = [requests, cpu, latency, errors, time, dRequests, dCpu, dLatency, dErrors, hour, day, yRequests, yCpu, yLatency, yErrors, ...lines, ...titles, title, legendPanel, cursor, tooltip, toolbox]
  return {
    objects,
    tooltip,
    destroy: () => destroyAll(all),
  }
}
export type AxesScenario = ReturnType<typeof createAxesScenario>
