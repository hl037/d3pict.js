import { D3PRChart, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createAxesScenario, type AxesScenario } from '../scenarios/axes'
import { useScenario } from './useScenario'

export function Axes() {
  const { scenario } = useScenario(createAxesScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, tooltip } }: { scene: AxesScenario }) {
  // #region view
  return (
    <>
      <div className="chart-host">
        <D3PRChart objects={objects} />
      </div>
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
