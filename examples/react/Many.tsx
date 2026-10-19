import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createManyScenario, type ManyScenario } from '../scenarios/many'
import { useScenario } from './useScenario'

export function Many() {
  const { scenario } = useScenario(createManyScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, tooltip } }: { scene: ManyScenario }) {
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
