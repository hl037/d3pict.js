import { D3PRChart, D3PRLegend, D3PRTooltip } from 'd3pict/react'
import { GALLERY } from '../scenarios/gallery'
import { useScenario } from './useScenario'

/** The chart of one scene of the gallery. */
export function ChartType({ id }: { id: string }) {
  const { scenario: scene } = useScenario((bus) => GALLERY.find((g) => g.id === id)!.build(bus))
  if (!scene) return null
  return (
    <>
      <div className="chart-host">
        <D3PRChart objects={scene.objects} margin={scene.margin} />
      </div>
      {scene.legend && <D3PRLegend legend={scene.legend} />}
      {scene.tooltip && <D3PRTooltip tooltip={scene.tooltip} />}
    </>
  )
}
