import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createSyncedScenario, type SyncedScenario } from '../scenarios/synced'
import { useScenario } from './useScenario'

export function Synced() {
  const { scenario } = useScenario(createSyncedScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { charts, tooltip } }: { scene: SyncedScenario }) {
  // #region view
  return (
    <>
      <div className="chart-column">
        {charts.map((chart, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <D3PRChart objects={chart.objects} margin={chart.margin} />
          </div>
        ))}
      </div>
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
