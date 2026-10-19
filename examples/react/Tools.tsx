import { useEffect, useState } from 'react'
import { D3PRChart, D3PRLegend, D3PRTooltip, useD3PBus } from 'd3pict/react'
import { createToolsScenario, type ToolsScenario } from '../scenarios/tools'
import { useScenario } from './useScenario'

export function Tools() {
  const { scenario } = useScenario(createToolsScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, toolbox, reset } }: { scene: ToolsScenario }) {
  // #region view
  // a button per tool, lit while the tool is active
  const names = ['pan', 'zoom-selection', 'zoom-click', 'wheel-zoom', 'wheel-pan']
  const bus = useD3PBus()
  const [, redraw] = useState(0)
  useEffect(() => bus.on(toolbox.e.toolStateChanged, () => redraw((n) => n + 1)), [bus, toolbox])
  return (
    <>
      <div className="toolbar">
        {names.map((name) => (
          <button key={name} className={toolbox.isToolActive(name) ? 'on' : ''} onClick={() => toolbox.setToolActive(name, !toolbox.isToolActive(name))}>
            {name}
          </button>
        ))}
        <button onClick={() => reset.reset()}>reset</button>
      </div>
      <div className="chart-host">
        <D3PRChart objects={objects} />
      </div>
    </>
  )
  // #endregion view
}
