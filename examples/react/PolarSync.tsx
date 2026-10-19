import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createPolarSyncScenario, type PolarSyncScenario } from '../scenarios/polarsync'
import { useScenario } from './useScenario'

export function PolarSync() {
  const { scenario } = useScenario(createPolarSyncScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { charts, tooltip, legend } }: { scene: PolarSyncScenario }) {
  // #region view
  return (
    <>
      <div className="chart-row">
        {charts.map((chart, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <D3PRChart objects={chart.objects} margin={chart.margin} />
          </div>
        ))}
      </div>
      <D3PRLegend legend={legend} />
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
