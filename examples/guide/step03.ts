import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PLineRenderer, D3PSeries, type D3PBus,
} from '../../src'
import { destroyAll } from '../scenarios/destroy'

/** Step 3 of the guide: several series, style. */
export function createStep03(bus: D3PBus) {
  // #region chart
  const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })
  const feelsLike = new D3PSeries({ bus, name: 'feels like', data: [[0, 10], [4, 6], [8, 12], [12, 22], [16, 25], [20, 15], [24, 11]] })

  const hours = new D3PAxisDomain({ bus, domain: [0, 24] })
  const degrees = new D3PAxisDomain({ bus, domain: [0, 30] })
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(temperature, [hours, degrees])
  auto.linkSeries(feelsLike, [hours, degrees])

  const x = new D3PAxis({ bus, name: 'hour', domain: hours, props: { tickCount: 6, tickFormat: (v) => `${Math.round(v)} h`, grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'temperature', domain: degrees, position: 'left', props: { tickFormat: (v) => `${Math.round(v * 10) / 10} °C`, grid: { enabled: true } } })
  // one renderer per series; its style is a prop
  const line = new D3PLineRenderer({ bus, series: temperature, props: { style: { color: '#e15759', curve: 'monotone', strokeWidth: 2.5 } } })
  const feelsLine = new D3PLineRenderer({ bus, series: feelsLike, props: { style: { color: '#4e79a7', curve: 'monotone' } } })

  const objects = [x, y, line, feelsLine]
  // #endregion chart
  return { objects, destroy: () => destroyAll([temperature, feelsLike, hours, degrees, auto, x, y, line, feelsLine]) }
}
export type Step03 = ReturnType<typeof createStep03>
