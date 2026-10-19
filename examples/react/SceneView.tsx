import type { D3PBus } from 'd3pict'
import { D3PRChart, D3PRLegend, D3PRTooltip } from 'd3pict/react'
import type { SingleScene } from '../core/scene'
import { useScenario } from './useScenario'

/** The chart of a scenario that builds a single chart. */
export function SceneView({ build }: { build: (bus: D3PBus) => SingleScene }) {
  const { scenario: scene } = useScenario(build)
  if (!scene) return null
  return (
    <>
      {scene.actions && (
        <div className="toolbar">
          {Object.entries(scene.actions).map(([name, run]) => (
            <button key={name} onClick={run}>
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="chart-host">
        <D3PRChart objects={scene.objects} margin={scene.margin} />
      </div>
      {scene.legend && <D3PRLegend legend={scene.legend} />}
      {scene.tooltip && <D3PRTooltip tooltip={scene.tooltip} />}
    </>
  )
}
