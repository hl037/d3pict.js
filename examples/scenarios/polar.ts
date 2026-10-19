import {
  D3PAngleAxis, D3PAreaRenderer, D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PCursorIndicator, D3PCursorRadiusAxisRenderer, D3PLegendBundle,
  D3PLineRenderer, D3PPanTool, D3PRadiusAxis, D3PResetTool, D3PSeries, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { destroyAll } from './destroy'

export const GEOMETRIES = ['cartesian', 'polar'] as const
export type Geometry = (typeof GEOMETRIES)[number]

// #region data
/**
 * One value per 5 degrees over three turns (-360 to 720): the part outside of the angle domain is
 * not drawn, so dragging the angle turns the pattern without leaving a gap.
 */
function pattern(amplitude: number, base: number, lobes: number, phase = 0): [number, number][] {
  return Array.from({ length: 217 }, (_, i) => {
    const deg = -360 + i * 5
    return [deg, base + amplitude * Math.cos((lobes * deg * Math.PI) / 180 + phase)]
  })
}
// #endregion data

/**
 * The same series, renderers, tooltip, cursor, legend and tools in two geometries. Only the
 * axes differ: `objects('cartesian')` and `objects('polar')` share everything else, so a chart
 * switches from one to the other by swapping its axes.
 */
export function createPolarScenario(bus: D3PBus) {
  // #region chart
  const angle = new D3PAxisDomain({ bus, domain: [0, 360] })
  const radius = new D3PAxisDomain({ bus, domain: [0, 100] })
  const lobes = new D3PSeries({ bus, name: 'lobes', data: pattern(35, 55, 4) })
  const swell = new D3PSeries({ bus, name: 'swell', data: pattern(15, 40, 2, 1) })

  const axisProps = { grid: { enabled: true } }
  const axes = {
    cartesian: [
      new D3PAxis({ bus, name: 'angle', domain: angle, position: 'bottom', props: { ...axisProps, tickFormat: (v: number) => `${Math.round(v)}°` } }),
      new D3PAxis({ bus, name: 'radius', domain: radius, position: 'left', props: axisProps }),
    ],
    polar: [
      new D3PAngleAxis({ bus, name: 'angle', domain: angle, props: { ...axisProps, tickCount: 12, tickFormat: (v: number) => `${Math.round(v)}°` } }),
      // the spoke of the radius axis turns to follow the pointer
      new D3PRadiusAxis({ bus, name: 'radius', domain: radius, props: axisProps, renderer: new D3PCursorRadiusAxisRenderer() }),
    ],
  }

  const area = new D3PAreaRenderer({ bus, series: lobes, name: 'lobes area', marker: false, props: { style: { color: '#4e79a7', opacity: 0.2 } } })
  const lobesLine = new D3PLineRenderer({ bus, series: lobes, props: { style: { color: '#4e79a7' } } })
  const swellLine = new D3PLineRenderer({ bus, series: swell, props: { style: { color: '#e15759' } } })
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus, series: [lobesLine, swellLine] })
  const legend = new D3PLegendBundle({ bus, series: [lobesLine, swellLine] })

  // the angle turns (drag), the radius zooms (wheel): in cartesian, X pans and Y zooms
  const toolbox = new D3PToolbox({ bus })
  toolbox.addTool(new D3PPanTool({ bus, axes: ['angle'] }))
  toolbox.addTool(new D3PWheelZoomTool({ bus, axes: ['radius'] }))
  toolbox.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)
  // the axes are the only thing that depends on the geometry: the chart takes one set of them and `shared`
  const shared = [area, lobesLine, swellLine, cursor, tooltip, legend, toolbox]
  // #endregion chart
  const all = [angle, radius, lobes, swell, ...axes.cartesian, ...axes.polar, ...shared]
  return {
    axes,
    shared,
    tooltip,
    legend,
    destroy: () => destroyAll(all),
  }
}
export type PolarScenario = ReturnType<typeof createPolarScenario>
