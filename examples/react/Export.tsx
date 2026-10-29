import { useState } from 'react'
import type { D3PChart } from 'd3pict'
import { D3PRChart, D3PRTooltip } from 'd3pict/react'
import { createExportScenario, type ExportScenario } from '../scenarios/export'
import { useScenario } from './useScenario'

export function ExportExample() {
  const { scenario } = useScenario(createExportScenario)
  return scenario && <View scene={scenario} />
}

function View({ scene: { objects, tooltip, fileName } }: { scene: ExportScenario }) {
  // #region view
  // the options of an export: the colors of the page are not the ones of the file
  const themes = { light: {}, dark: { background: '#111827', color: '#e5e7eb' }, transparent: { background: null } }
  const [theme, setTheme] = useState<keyof typeof themes>('light')
  const [scale, setScale] = useState(2)
  const options = () => ({ ...themes[theme], scale })

  // the chart, once it is created, and a preview: the PNG that would be saved
  const [chart, setChart] = useState<D3PChart>()
  const [preview, setPreview] = useState('')

  return (
    <>
      <div className="toolbar">
        <button disabled={!chart} onClick={() => chart?.downloadSVG(`${fileName}.svg`, options())}>
          save SVG
        </button>
        <button disabled={!chart} onClick={() => chart?.downloadPNG(`${fileName}.png`, options())}>
          save PNG
        </button>
        <button disabled={!chart} onClick={async () => setPreview(await chart!.exportPNG(options()))}>
          preview
        </button>
        <select title="background" value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
          {Object.keys(themes).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select title="PNG scale" value={scale} onChange={(e) => setScale(+e.target.value)}>
          {[1, 2, 4].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </div>
      <div className="chart-host">
        <D3PRChart objects={objects} onReady={setChart} />
      </div>
      {preview && <img src={preview} alt="preview of the PNG" style={{ alignSelf: 'flex-start', maxWidth: '100%', maxHeight: 220, objectFit: 'contain', border: '1px solid #ccc', background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px' }} />}
      <D3PRTooltip tooltip={tooltip} />
    </>
  )
  // #endregion view
}
