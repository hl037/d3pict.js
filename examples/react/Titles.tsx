import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createTitlesScenario, type TitlesScenario } from '../scenarios/titles'
import { useScenario } from './useScenario'

export function Titles() {
  const { scenario } = useScenario(createTitlesScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, tooltip } }: { scene: TitlesScenario }) {
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
