import {
  D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PCursorIndicator, D3PLegendBundle, D3PLineRenderer, D3PPanTool,
  D3PResetTool, D3PSeries, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { timeSeries, walk } from '../shared/data'
import { destroyAll } from './destroy'

/** Two time series with area, cursor, tooltip, legend, wheel zoom and pan. */
export function createLinesScenario(bus: D3PBus) {
  // #region chart
  const cpuData = timeSeries(walk(1, 240, 40, 12))
  const memData = timeSeries(walk(2, 240, 60, 6))

  const dx = new D3PAxisDomain({ bus, domain: [cpuData[0][0], cpuData[cpuData.length - 1][0]] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const cpu = new D3PSeries({ bus, name: 'cpu', data: cpuData })
  const mem = new D3PSeries({ bus, name: 'memory', data: memData })

  // the domains follow the data
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(cpu, [dx, dy])
  auto.linkSeries(mem, [dx, dy])

  const x = new D3PAxis({ bus, name: 'x', domain: dx, scaleType: 'time' })
  const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { displayName: 'usage', tickFormat: (v) => `${Math.round(v)} %`, grid: { enabled: true } } })

  // the line of the same series shows the point under the pointer: the area needs no marker of its own
  const area = new D3PAreaRenderer({ bus, series: cpu, name: 'cpu area', marker: false, props: { style: { color: '#4e79a7', opacity: 0.2 } } })
  const cpuLine = new D3PLineRenderer({ bus, series: cpu, props: { style: { color: '#4e79a7' } } })
  const memLine = new D3PLineRenderer({ bus, series: mem, props: { style: { color: '#e15759' } } })

  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus, series: [cpuLine, memLine] })
  const legend = new D3PLegendBundle({ bus, series: [cpuLine, memLine] })

  const toolbox = new D3PToolbox({ bus })
  toolbox.addTool(new D3PPanTool({ bus }))
  toolbox.addTool(new D3PWheelZoomTool({ bus }))
  toolbox.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)

  // what goes on the chart, and the margin the axes need
  const objects = [x, y, area, cpuLine, memLine, cursor, tooltip, legend, toolbox]
  const margin = { left: 60 }
  // #endregion chart
  const all = [dx, dy, cpu, mem, auto, x, y, area, cpuLine, memLine, cursor, tooltip, legend, toolbox]
  return {
    objects,
    margin,
    tooltip,
    legend,
    destroy: () => destroyAll(all),
  }
}
export type LinesScenario = ReturnType<typeof createLinesScenario>
