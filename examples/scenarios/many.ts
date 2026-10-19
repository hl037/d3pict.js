import * as d3 from 'd3'
import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PCursorIndicator, D3PLegendPanel, D3PLineRenderer, D3PSeries, D3PTitle, D3PTooltip, type D3PBus,
} from '../../src'
import { indexed, walk } from '../shared/data'
import { destroyAll } from './destroy'

/** Thirty-two series: the legend wraps, then scrolls; the tooltip shows its entries in columns. */
export function createManyScenario(bus: D3PBus) {
  // #region chart
  const servers = Array.from({ length: 32 }, (_, i) => `server ${String(i + 1).padStart(2, '0')}`)
  const series = servers.map((name, i) => new D3PSeries({ bus, name, data: indexed(walk(100 + i, 60, 15 + (i % 8) * 9, 10, 0, 100)) }))

  const dx = new D3PAxisDomain({ bus, domain: [0, 59] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 100] })
  const auto = new D3PAutoDomain({ bus })
  for (const s of series) auto.linkSeries(s, [dx, dy])

  const x = new D3PAxis({ bus, name: 'x', domain: dx, props: { displayName: 'minute' } })
  const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { displayName: 'load (%)', grid: { enabled: true } } })
  // one color per series, spread over the rainbow
  const lines = series.map((s, i) => new D3PLineRenderer({ bus, series: s, props: { style: { color: d3.interpolateRainbow(i / servers.length), strokeWidth: 1.5 } } }))

  const title = new D3PTitle({ bus, props: { text: 'Load of 32 servers' } })
  const xTitle = new D3PAxisTitle({ bus, axis: x })
  const yTitle = new D3PAxisTitle({ bus, axis: y })
  // the legend gets as many lines as it needs, then scrolls
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })
  const objects = [x, y, ...lines, title, xTitle, yTitle, legendPanel, cursor, tooltip]
  // #endregion chart
  const all = [dx, dy, auto, ...series, ...objects]
  return { objects, tooltip, destroy: () => destroyAll(all) }
}
export type ManyScenario = ReturnType<typeof createManyScenario>
