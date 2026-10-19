import { D3PLegendBundle, D3PPieRenderer, D3PPolarSystem, D3PSeries, D3PTooltip, type D3PBus } from '../../src'
import { destroyAll } from './destroy'

export const SHAPES = ['pie', 'donut'] as const
export type Shape = (typeof SHAPES)[number]

/**
 * A pie chart: one renderer on a series of `[name, size]` pairs, no axes. It draws in a polar
 * coordinate system, whose `innerRadius` turns the pie into a donut.
 */
export function createPieScenario(bus: D3PBus) {
  // #region chart
  const share = new D3PSeries({
    bus,
    name: 'browsers',
    data: [['Chrome', 62], ['Safari', 20], ['Edge', 5.5], ['Firefox', 3.2], ['Samsung', 2.6], ['Opera', 2.1], ['Other', 4.6]],
  })
  const system = new D3PPolarSystem({ bus, props: { padding: 20 } })
  const pie = new D3PPieRenderer({ bus, series: share, props: { padAngle: 1, cornerRadius: 3, sort: 'descending' } })
  const tooltip = new D3PTooltip({ bus })
  const legend = new D3PLegendBundle({ bus })
  // the system comes first: the pie draws in it
  const objects = [system, pie, tooltip, legend]
  // #endregion chart
  const all = [share, system, pie, tooltip, legend]
  return {
    objects,
    system,
    tooltip,
    legend,
    destroy: () => destroyAll(all),
  }
}
export type PieScenario = ReturnType<typeof createPieScenario>
