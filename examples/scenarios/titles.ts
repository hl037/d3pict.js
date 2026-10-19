import {
  D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PCursorIndicator, D3PLegendPanel, D3PLineRenderer, D3PSeries, D3PTitle,
  D3PTooltip, type D3PBus,
} from '../../src'
import { timeSeries, walk } from '../shared/data'
import { destroyAll } from './destroy'

/** A chart with a title, titles on its axes and a legend: all of them are components to add to the chart. */
export function createTitlesScenario(bus: D3PBus) {
  // #region chart
  const cpuData = timeSeries(walk(1, 240, 40, 12))
  const memData = timeSeries(walk(2, 240, 60, 6))

  const dx = new D3PAxisDomain({ bus, domain: [cpuData[0][0], cpuData[cpuData.length - 1][0]] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const cpu = new D3PSeries({ bus, name: 'cpu', data: cpuData })
  const mem = new D3PSeries({ bus, name: 'memory', data: memData })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(cpu, [dx, dy])
  auto.linkSeries(mem, [dx, dy])

  const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'time', props: { displayName: 'time' } })
  const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { displayName: 'usage (%)', grid: { enabled: true } } })
  const cpuArea = new D3PAreaRenderer({ bus, series: cpu, name: 'cpu area', marker: false, props: { style: { color: '#4e79a7', opacity: 0.2 } } })
  const cpuLine = new D3PLineRenderer({ bus, series: cpu, props: { style: { color: '#4e79a7' } } })
  const memLine = new D3PLineRenderer({ bus, series: mem, props: { style: { color: '#e15759' } } })

  // each of these reserves room around the plot: the plot gets smaller by as much
  const title = new D3PTitle({ bus, props: { text: 'Server load', subtitle: 'cpu and memory over the last four hours' } })
  const xTitle = new D3PAxisTitle({ bus, axis: x })
  const yTitle = new D3PAxisTitle({ bus, axis: y }) // the text is the display name of the axis, unless `props.text` says otherwise
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom', series: [cpuLine, memLine] })

  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus, series: [cpuLine, memLine] })
  const objects = [x, y, cpuArea, cpuLine, memLine, title, xTitle, yTitle, legendPanel, cursor, tooltip]
  // #endregion chart
  const all = [dx, dy, cpu, mem, auto, ...objects]
  return { objects, tooltip, destroy: () => destroyAll(all) }
}
export type TitlesScenario = ReturnType<typeof createTitlesScenario>
