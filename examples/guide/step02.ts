import {
  D3PAutoDomain, D3PAxis, D3PAxisDomain, D3PLineRenderer, D3PSeries, type D3PBus,
} from '../../src'
import { destroyAll } from '../scenarios/destroy'

/** Step 2 of the guide: axes and domains. */
export function createStep02(bus: D3PBus) {
  // #region chart
  const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })

  // the domain of an axis is the range of values it shows
  const hours = new D3PAxisDomain({ bus, domain: [0, 24] })
  const degrees = new D3PAxisDomain({ bus, domain: [0, 30] })
  // an auto domain fits the domains to the data of the series it is linked to
  const auto = new D3PAutoDomain({ bus })
  auto.linkSeries(temperature, [hours, degrees])

  const x = new D3PAxis({ bus, name: 'hour', domain: hours, props: { tickCount: 6, tickFormat: (v) => `${Math.round(v)} h`, grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'temperature', domain: degrees, position: 'left', props: { tickFormat: (v) => `${Math.round(v * 10) / 10} °C`, grid: { enabled: true } } })
  const line = new D3PLineRenderer({ bus, series: temperature })

  const objects = [x, y, line]
  // #endregion chart
  return { objects, destroy: () => destroyAll([temperature, hours, degrees, auto, x, y, line]) }
}
export type Step02 = ReturnType<typeof createStep02>
