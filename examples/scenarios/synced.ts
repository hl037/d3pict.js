import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PBarRenderer, D3PCursorIndicator, D3PLineRenderer, D3PPanTool, D3PResetTool, D3PSeries,
  D3PToolbox, D3PTooltip, D3PWheelZoomTool, type D3PBus,
} from '../../src'
import { indexed, rng, walk } from '../shared/data'
import { destroyAll } from './destroy'

/**
 * Two charts sharing one X axis (and so one X domain): zooming or panning one moves the other.
 * One tooltip and one toolbox span both charts; the tools only act on `x`.
 */
export function createSyncedScenario(bus: D3PBus) {
  // #region chart
  const n = 80
  const r = rng(11)
  const price = new D3PSeries({ bus, name: 'price', data: indexed(walk(3, n, 50, 8, 10, 90)) })
  const volume = new D3PSeries({ bus, name: 'volume', data: indexed(Array.from({ length: n }, () => Math.round(r() * 100))) })

  const dx = new D3PAxisDomain({ bus, domain: [0, n - 1] })
  const dPrice = new D3PAxisDomain({ bus, domain: [0, 100] })
  const dVolume = new D3PAxisDomain({ bus, domain: [0, 100] })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(price, [dx, dPrice])
  auto.linkSeries(volume, [dx, dVolume])

  const x = new D3PAxis({ bus, name: 'x', domain: dx, props: { grid: { enabled: true } } })
  const yPrice = new D3PAxis({ bus, name: 'price', domain: dPrice, position: 'left', props: { grid: { enabled: true } } })
  const yVolume = new D3PAxis({ bus, name: 'volume', domain: dVolume, position: 'left' })
  const line = new D3PLineRenderer({ bus, series: price, axes: ['x', 'price'], props: { style: { color: '#b07aa1' } } })
  const bars = new D3PBarRenderer({ bus, series: volume, axes: ['x', 'volume'], props: { style: { color: '#76b7b2', barWidth: 6 } } })

  const cursor = new D3PCursorIndicator({ bus })
  const tooltip = new D3PTooltip({ bus })
  const toolbox = new D3PToolbox({ bus })
  toolbox.addTool(new D3PPanTool({ bus, axes: ['x'] }))
  toolbox.addTool(new D3PWheelZoomTool({ bus, axes: ['x'] }))
  toolbox.addTool(new D3PResetTool({ bus }))
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)

  // the cursor, the tooltip and the tools are attached to both charts, and so is the axis `x`
  const shared = [cursor, tooltip, toolbox]
  const margin = { left: 70 }
  const charts = [
    { objects: [x, yPrice, line, ...shared], margin },
    { objects: [x, yVolume, bars, ...shared], margin },
  ]
  // #endregion chart
  const all = [dx, dPrice, dVolume, price, volume, auto, x, yPrice, yVolume, line, bars, ...shared]
  return {
    charts,
    tooltip,
    destroy: () => destroyAll(all),
  }
}
export type SyncedScenario = ReturnType<typeof createSyncedScenario>
