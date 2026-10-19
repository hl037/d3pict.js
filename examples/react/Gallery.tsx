import { useEffect, useState } from 'react'
import { D3PRChart, D3PRLegend, D3PRTooltip } from '../../src/react'
import { GALLERY, type GalleryScene } from '../scenarios/gallery'
import { t, type MessageKey } from '../shared/i18n'
import { useD3PBus } from '../../src/react'

const GROUPS = ['cartesian', 'polar', 'noaxes'] as const

export function Gallery() {
  const bus = useD3PBus()
  const [id, setId] = useState(GALLERY[0].id)
  const [built, setBuilt] = useState<{ id: string; scene: GalleryScene }>()

  // a scene per chart type, destroyed when it is replaced (an effect, so StrictMode's double mount is fine)
  useEffect(() => {
    const scene = GALLERY.find((g) => g.id === id)!.build(bus)
    setBuilt({ id, scene })
    return () => {
      scene.destroy()
      setBuilt(undefined)
    }
  }, [id, bus])

  // never draw a scene that is not the one selected: it is about to be destroyed
  const scene = built?.id === id ? built.scene : undefined

  return (
    <>
      <div className="toolbar">
        <select className="type-select" value={id} onChange={(e) => setId(e.target.value)}>
          {GROUPS.map((g) => (
            <optgroup key={g} label={t(`group.${g}` as MessageKey)}>
              {GALLERY.filter((x) => x.group === g).map((e) => (
                <option key={e.id} value={e.id}>
                  {t(`type.${e.id}` as MessageKey)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="chart-host">
        {scene && (
          <>
            {/* a new chart per scene: each has its own margins */}
            <D3PRChart key={id} objects={scene.objects} margin={scene.margin} />
            {scene.legend && <D3PRLegend legend={scene.legend} />}
            {scene.tooltip && <D3PRTooltip tooltip={scene.tooltip} />}
          </>
        )}
      </div>
    </>
  )
}
