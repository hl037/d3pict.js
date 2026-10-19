import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createShowcaseScenario, type ShowcaseScenario } from '../scenarios/showcase'
import { useScenario } from './useScenario'

export function Showcase() {
  const { scenario } = useScenario(createShowcaseScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { charts, tooltip, actions, sizes, setSize } }: { scene: ShowcaseScenario }) {
  // #region view
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
          <div key={i} style={{ flex: 1, minWidth: 0, minHeight: 360 }}>
            <D3PRChart objects={chart.objects} margin={chart.margin} />
          </div>
        ))}
      </div>
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
