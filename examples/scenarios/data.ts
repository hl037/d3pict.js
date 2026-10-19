import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PBarRenderer, D3PCursorIndicator, D3PLineRenderer, D3PSeries, D3PTooltip, type D3PBus,
} from '../../src'
import { destroyAll } from './destroy'

/** One series that grows, shrinks and is replaced; the bars and the line follow it, and so do the axes. */
export function createDataScenario(bus: D3PBus) {
  // #region chart
  const sales = new D3PSeries({ bus, name: 'sales', data: [[0, 34], [1, 52], [2, 41], [3, 67], [4, 58], [5, 73], [6, 49], [7, 62]] })

  // the domains follow the data: they are fitted again each time it changes
  const dx = new D3PAxisDomain({ bus, domain: [0, 7] })
  const dy = new D3PAxisDomain({ bus, domain: [0, 80] })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(sales, [dx, dy])

  const x = new D3PAxis({ bus, name: 'month', domain: dx, props: { tickFormat: (v) => `${Math.round(v)}`, grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'sales', domain: dy, position: 'left', props: { grid: { enabled: true } } })
  const bars = new D3PBarRenderer({ bus, series: sales, marker: false, props: { style: { color: '#9ccc96', barWidth: 18 } } })
  const line = new D3PLineRenderer({ bus, series: sales, props: { style: { color: '#4e79a7', curve: 'monotone', strokeWidth: 2.5 } } })

  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })
  const objects = [x, y, bars, line, cursor, tooltip]

  // changing the data is assigning the series: what draws it moves from what was there to what is there now
  const value = () => Math.round(20 + Math.random() * 60)
  const actions: Record<string, () => void> = {
    'add a point': () => {
      const last = sales.data.at(-1)
      sales.data = [...sales.data, [last ? +last[0] + 1 : 0, value()]]
    },
    'remove the last': () => (sales.data = sales.data.slice(0, -1)),
    'remove the first': () => (sales.data = sales.data.slice(1)),
    'replace': () => (sales.data = Array.from({ length: 5 + Math.floor(Math.random() * 8) }, (_, i) => [i, value()])),
  }
  // #endregion chart
  return { objects, tooltip, actions, destroy: () => destroyAll([sales, dx, dy, auto, x, y, bars, line, cursor, tooltip]) }
}
export type DataScenario = ReturnType<typeof createDataScenario>
