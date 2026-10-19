import {
  D3PAxis, D3PAxisDomain, D3PLineRenderer, D3PSeries, type D3PBus,
} from '../../src'
import { destroyAll } from '../scenarios/destroy'

/** Step 1 of the guide: a line. */
export function createStep01(bus: D3PBus) {
  // #region chart
  const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })

  const x = new D3PAxis({ bus, name: 'hour', domain: new D3PAxisDomain({ bus, domain: [0, 24] }) })
  const y = new D3PAxis({ bus, name: 'temperature', domain: new D3PAxisDomain({ bus, domain: [0, 30] }), position: 'left' })
  const line = new D3PLineRenderer({ bus, series: temperature })

  const objects = [x, y, line]
  // #endregion chart
  return { objects, destroy: () => destroyAll([temperature, x, y, line]) }
}
export type Step01 = ReturnType<typeof createStep01>
