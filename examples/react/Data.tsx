import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createDataScenario, type DataScenario } from '../scenarios/data'
import { useScenario } from './useScenario'

export function Data() {
  const { scenario } = useScenario(createDataScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, tooltip, actions } }: { scene: DataScenario }) {
  // #region view
  return (
    <>
      <div className="toolbar">
        {Object.entries(actions).map(([name, run]) => (
          <button key={name} onClick={run}>
            {name}
          </button>
        ))}
      </div>
      <div className="chart-host">
        <D3PRChart objects={objects} />
      </div>
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
