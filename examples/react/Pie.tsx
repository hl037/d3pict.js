import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createPieScenario, type PieScenario } from '../scenarios/pie'
import { useScenario } from './useScenario'

export function Pie() {
  const { scenario } = useScenario(createPieScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, system, tooltip, legend } }: { scene: PieScenario }) {
  // #region view
  // a pie is a donut with no hole
  const shapes = { pie: 0, donut: 0.55 }
  return (
    <>
      <div className="toolbar">
        {Object.entries(shapes).map(([name, innerRadius]) => (
          <button key={name} onClick={() => system.props({ innerRadius })}>
            {name}
          </button>
        ))}
      </div>
      <div className="chart-host">
        <D3PRChart objects={objects} />
      </div>
      <D3PRLegend legend={legend} />
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
