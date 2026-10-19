import {
  D3PAngleAxis, D3PAreaRenderer, D3PAxis, D3PAxisDomain, D3PCursorIndicator, D3PCursorRadiusAxisRenderer, D3PLegendBundle, D3PLineRenderer, D3PPanTool,
  D3PRadiusAxis, D3PResetTool, D3PSeries, D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { destroyAll } from './destroy'

// #region data
/** One value per 5 degrees over three turns, so dragging the angle turns the pattern without a gap. */
function pattern(amplitude: number, base: number, lobes: number, phase = 0): [number, number][] {
  return Array.from({ length: 217 }, (_, i) => {
    const deg = -360 + i * 5
    return [deg, base + amplitude * Math.cos((lobes * deg * Math.PI) / 180 + phase)]
  })
}
// #endregion data

/**
 * A cartesian chart and a polar one on the same data. They share both domains (the angle, and the
 * magnitude), and are given the same renderers, cursor, tooltip and tools: dragging the cartesian X
 * axis turns the polar chart, zooming the magnitude zooms both, and the pointer shows its
 * value on both charts at once.
 */
export function createPolarSyncScenario(bus: D3PBus) {
  // #region chart
  const lobes = new D3PSeries({ bus, name: 'lobes', data: pattern(35, 55, 4) })
  const swell = new D3PSeries({ bus, name: 'swell', data: pattern(15, 40, 2, 1) })

  // the two charts read these two domains
  const angle = new D3PAxisDomain({ bus, domain: [0, 360] })
  const magnitude = new D3PAxisDomain({ bus, domain: [0, 100] })
  const degrees = (v: number) => `${Math.round(v)}°`
  const grid = { enabled: true }

  // the same names on both charts: that is what the tooltip and the cursor follow across them
  const cartesian = [
    new D3PAxis({ bus, name: 'angle', domain: angle, props: { tickFormat: degrees, grid } }),
    new D3PAxis({ bus, name: 'magnitude', domain: magnitude, position: 'left', props: { grid } }),
  ]
  const polar = [
    new D3PAngleAxis({ bus, name: 'angle', domain: angle, props: { tickFormat: degrees, tickCount: 12, grid } }),
    new D3PRadiusAxis({ bus, name: 'magnitude', domain: magnitude, props: { grid }, renderer: new D3PCursorRadiusAxisRenderer() }),
  ]

  // renderers, cursor, tooltip and tools are attached to both charts, and find their axes by name
  // the line of the same series shows the point under the pointer: the area needs no marker of its own
  const area = new D3PAreaRenderer({ bus, series: lobes, name: 'lobes area', marker: false, axes: ['angle', 'magnitude'], props: { style: { color: '#4e79a7', opacity: 0.2 } } })
  const lobesLine = new D3PLineRenderer({ bus, series: lobes, axes: ['angle', 'magnitude'], props: { style: { color: '#4e79a7' } } })
  const swellLine = new D3PLineRenderer({ bus, series: swell, axes: ['angle', 'magnitude'], props: { style: { color: '#e15759' } } })
  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus, series: [lobesLine, swellLine] })
  const legend = new D3PLegendBundle({ bus, series: [lobesLine, swellLine] })

  const toolbox = new D3PToolbox({ bus })
  toolbox.addTool(new D3PPanTool({ bus, axes: ['angle'] }))
  toolbox.addTool(new D3PWheelZoomTool({ bus, axes: ['magnitude'] }))
  toolbox.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)

  // the legend is drawn once, on the first chart
  const shared = [area, lobesLine, swellLine, cursor, tooltip, toolbox]
  const charts = [
    { objects: [...cartesian, ...shared, legend], margin: { left: 56 } },
    { objects: [...polar, ...shared] },
  ]
  // #endregion chart

  const all = [lobes, swell, angle, magnitude, ...cartesian, ...polar, ...shared, legend]
  return {
    charts,
    tooltip,
    legend,
    destroy: () => destroyAll(all),
  }
}
export type PolarSyncScenario = ReturnType<typeof createPolarSyncScenario>
