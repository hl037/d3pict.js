import {
  D3PAnnotationLine, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PBarRenderer, D3PCursorIndicator, D3PLegendPanel, D3PSeries, D3PTitle, D3PTooltip,
  type D3PBus,
} from '../../src'
import { destroyAll } from './destroy'

/** A chart with what an export has to carry: a title, titles of axes, a legend, an annotation. The cursor and the tooltip are left out of the file. */
export function createExportScenario(bus: D3PBus) {
  // #region chart
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const revenue = new D3PSeries({ bus, name: 'revenue', data: months.map((month, i) => [month, Math.round(38 + 22 * Math.sin(i / 1.8) + i * 2.5)]) })

  const month = new D3PAxis({ bus, name: 'month', domain: new D3PAxisDomain({ bus, domain: months }), scaleType: 'band' })
  const amount = new D3PAxis({ bus, name: 'revenue', domain: new D3PAxisDomain({ bus, domain: [0, 100] }), position: 'left', props: { tickFormat: (v) => `${Math.round(v)} k€`, grid: { enabled: true } } })
  const columns = new D3PBarRenderer({ bus, series: revenue, props: { style: { color: '#4e79a7', margin: 0.15 } } })
  const goal = new D3PAnnotationLine({ bus, axis: amount, value: 70, label: 'goal', style: { strokeDasharray: '6,4' } })

  // a title, titles for the axes and a legend: they are in the file
  const title = new D3PTitle({ bus, props: { text: 'Revenue by month', subtitle: 'in thousands of euros, 2026' } })
  const monthTitle = new D3PAxisTitle({ bus, axis: month, props: { text: 'month' } })
  const amountTitle = new D3PAxisTitle({ bus, axis: amount, props: { text: 'revenue' } })
  const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

  // the cursor and the tooltip only mean something while the pointer is there: they are not
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })

  // the name of the files the chart is saved as, without the extension
  const fileName = 'revenue'

  const objects = [month, amount, columns, goal, title, monthTitle, amountTitle, legendPanel, cursor, tooltip]
  // #endregion chart
  return { objects, tooltip, fileName, destroy: () => destroyAll([revenue, month, amount, columns, goal, title, monthTitle, amountTitle, legendPanel, cursor, tooltip]) }
}
export type ExportScenario = ReturnType<typeof createExportScenario>
