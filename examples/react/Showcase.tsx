import { useRef } from 'react'
import type { D3PChart } from 'd3pict'
import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createShowcaseScenario, type ShowcaseScenario } from '../scenarios/showcase'
import { useScenario } from './useScenario'

export function Showcase() {
  const { scenario } = useScenario(createShowcaseScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { charts, tooltip, actions, sizes, setSize } }: { scene: ShowcaseScenario }) {
  // #region view
  // the charts, once they are created: each one saves itself as a file
  const saved = useRef<D3PChart[]>([])
  return (
    <>
      <div className="toolbar">
        {Object.entries(actions).map(([name, run]) => (
          <button key={name} onClick={run}>
            {name}
          </button>
        ))}
        <select title="points of the last chart" onChange={(e) => setSize(+e.target.value)}>
          {sizes.map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString('en')} points
            </option>
          ))}
        </select>
      </div>
      <div className="chart-column">
        {charts.map((chart, i) => (
          <div key={i} style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 360 }}>
            <D3PRChart objects={chart.objects} margin={chart.margin} onReady={(c) => (saved.current[i] = c)} />
            <div className="toolbar" style={{ position: 'absolute', top: 4, right: 8, zIndex: 2 }}>
              <button onClick={() => saved.current[i]?.downloadSVG(`${chart.name}.svg`)}>SVG</button>
              <button onClick={() => saved.current[i]?.downloadPNG(`${chart.name}.png`)}>PNG</button>
            </div>
          </div>
        ))}
      </div>
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
