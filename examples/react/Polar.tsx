import { useState } from 'react'
import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createPolarScenario, type PolarScenario } from '../scenarios/polar'
import { useScenario } from './useScenario'

export function Polar() {
  const { scenario } = useScenario(createPolarScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { axes, shared, tooltip, legend } }: { scene: PolarScenario }) {
  // #region view
  // the axes are the only thing that depends on the geometry: swap them, keep the rest attached
  const [geometry, setGeometry] = useState<'cartesian' | 'polar'>('polar')
  return (
    <>
      <div className="toolbar">
        {(['cartesian', 'polar'] as const).map((g) => (
          <button key={g} className={geometry === g ? 'on' : ''} onClick={() => setGeometry(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="chart-host">
        <D3PRChart objects={[...axes[geometry], ...shared]} />
      </div>
      <D3PRLegend legend={legend} />
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
