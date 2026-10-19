import {
  D3PAxis, D3PAxisDomain, D3PClickZoomTool, D3PCursorIndicator, D3PLineRenderer, D3PPanTool, D3PResetTool, D3PScatterRenderer,
  D3PSeries, D3PToolbox, D3PWheelPanTool, D3PWheelZoomTool, D3PZoomSelectionTool, type D3PBus,
} from '../../src'
import { indexed, walk } from '../shared/data'
import { t } from '../shared/i18n'
import { destroyAll } from './destroy'

const TOOL_NAMES = ['pan', 'zoom-selection', 'zoom-click', 'wheel-zoom', 'wheel-pan'] as const

/** Toggle buttons of the toolbox, labelled in the current locale. */
export function toolButtons(): { name: (typeof TOOL_NAMES)[number]; label: string }[] {
  return TOOL_NAMES.map((name) => ({ name, label: t(`tool.${name}`) }))
}

/** Every tool, with mutually exclusive groups: one drag tool and one wheel tool at a time. */
export function createToolsScenario(bus: D3PBus) {
  // #region chart
  const data = indexed(walk(7, 120, 0, 30, -100, 100))
  const dx = new D3PAxisDomain({ bus, domain: [0, 119] })
  const dy = new D3PAxisDomain({ bus, domain: [-100, 100] })
  const series = new D3PSeries({ bus, name: 'signal', data })
  const x = new D3PAxis({ bus, name: 'x', domain: dx, props: { grid: { enabled: true } } })
  const y = new D3PAxis({ bus, name: 'y', domain: dy, position: 'left', props: { grid: { enabled: true } } })
  const line = new D3PLineRenderer({ bus, series, props: { style: { color: '#59a14f', strokeWidth: 1.5 } } })
  const dots = new D3PScatterRenderer({ bus, series, name: 'points', props: { style: { color: '#59a14f', radius: 3 } } })
  const cursor = new D3PCursorIndicator({ bus })

  const toolbox = new D3PToolbox({ bus, mutuallyExclusiveGroups: [['pan', 'zoom-selection', 'zoom-click'], ['wheel-zoom', 'wheel-pan']] })
  const reset = new D3PResetTool({ bus })
  for (const t of [new D3PPanTool({ bus }), new D3PZoomSelectionTool({ bus }), new D3PClickZoomTool({ bus }), new D3PWheelZoomTool({ bus }), new D3PWheelPanTool({ bus }), reset]) toolbox.addTool(t)
  for (const name of ['pan', 'wheel-zoom', 'reset']) toolbox.setToolActive(name)

  const objects = [x, y, line, dots, cursor, toolbox]
  // #endregion chart
  const all = [dx, dy, series, x, y, line, dots, cursor, toolbox]
  return {
    objects,
    toolbox,
    /** Restore the views remembered by the always-active reset tool. */
    reset,
    destroy: () => destroyAll(all),
  }
}
export type ToolsScenario = ReturnType<typeof createToolsScenario>
