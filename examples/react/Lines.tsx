import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createLinesScenario, type LinesScenario } from '../scenarios/lines'
import { useScenario } from './useScenario'

export function Lines() {
  const { scenario } = useScenario(createLinesScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, margin, tooltip, legend } }: { scene: LinesScenario }) {
  // #region view
  return (
    <>
      <div className="chart-host">
        <D3PRChart objects={objects} margin={margin} />
      </div>
      <D3PRLegend legend={legend} />
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
