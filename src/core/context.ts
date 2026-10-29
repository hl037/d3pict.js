import { D3PAnchor } from './html'
import { D3PAngleAxis, D3PAxis, D3PRadiusAxis } from './axis'
import { D3PAnnotationBand, D3PAnnotationLine, D3PAnnotationPoint, D3PAnnotationText } from './annotation'
import { D3PAreaRenderer } from './renderers/area'
import { D3PAutoDomain, D3PSeries } from './series'
import { D3PAxisDomain } from './domain'
import { D3PAxisTitle, D3PTitle } from './titles'
import { D3PBarRenderer } from './renderers/bar'
import { D3PBoxPlotRenderer, D3PCandlestickRenderer, D3PDumbbellRenderer } from './renderers/glyph'
import { D3PBubbleRenderer } from './renderers/bubble'
import { D3PCartesianSystem, D3PPolarSystem } from './coords'
import { D3PChart } from './chart'
import { D3PClickZoomTool, D3PPassiveZoomTool, D3PWheelZoomTool } from './tools/zoom'
import { D3PColorLegend, D3PColorScale } from './color'
import { D3PCursorIndicator } from './cursor'
import { D3PFunnelRenderer } from './renderers/funnel'
import { D3PHeatmapRenderer } from './renderers/heatmap'
import { D3PInteractionArea } from './interaction'
import { D3PLegendBundle, D3PLegendContainer, D3PLegendManager } from './legend'
import { D3PLegendPanel } from './legend-panel'
import { D3PLineRenderer } from './renderers/line'
import { D3PPanTool } from './tools/pan'
import { D3PPieRenderer } from './renderers/pie'
import { D3PResetTool } from './tools/reset'
import { D3PScatterRenderer } from './renderers/scatter'
import { D3PSlot } from './slot'
import { D3PStack, D3PHistogram, D3PWaterfall } from './transforms'
import { D3PToolbox } from './tools/toolbox'
import { D3PTooltip, D3PTooltipContainer, D3PTooltipManager } from './tooltip'
import { D3PWheelPanTool } from './tools/wheel-pan'
import { D3PZoomSelectionTool } from './tools/zoom-selection'
import { getGlobalBus, type D3PBus } from './bus'

/** Anything a context can destroy later: every object of the library, and what you make of them. */
export interface D3PDestroyable {
  destroy(): void
}

/**
 * The classes a context makes objects of. `Series` gives `newSeries`, which does what
 * `new D3PSeries` does.
 */
const FACTORIES = {
  AnnotationBand: D3PAnnotationBand,
  AnnotationLine: D3PAnnotationLine,
  AnnotationPoint: D3PAnnotationPoint,
  AnnotationText: D3PAnnotationText,
  AngleAxis: D3PAngleAxis,
  Anchor: D3PAnchor,
  AreaRenderer: D3PAreaRenderer,
  AutoDomain: D3PAutoDomain,
  Axis: D3PAxis,
  AxisDomain: D3PAxisDomain,
  AxisTitle: D3PAxisTitle,
  BarRenderer: D3PBarRenderer,
  BoxPlotRenderer: D3PBoxPlotRenderer,
  BubbleRenderer: D3PBubbleRenderer,
  CandlestickRenderer: D3PCandlestickRenderer,
  CartesianSystem: D3PCartesianSystem,
  Chart: D3PChart,
  ClickZoomTool: D3PClickZoomTool,
  ColorLegend: D3PColorLegend,
  ColorScale: D3PColorScale,
  CursorIndicator: D3PCursorIndicator,
  DumbbellRenderer: D3PDumbbellRenderer,
  FunnelRenderer: D3PFunnelRenderer,
  HeatmapRenderer: D3PHeatmapRenderer,
  Histogram: D3PHistogram,
  InteractionArea: D3PInteractionArea,
  LegendBundle: D3PLegendBundle,
  LegendContainer: D3PLegendContainer,
  LegendManager: D3PLegendManager,
  LegendPanel: D3PLegendPanel,
  LineRenderer: D3PLineRenderer,
  PanTool: D3PPanTool,
  PassiveZoomTool: D3PPassiveZoomTool,
  PieRenderer: D3PPieRenderer,
  PolarSystem: D3PPolarSystem,
  RadiusAxis: D3PRadiusAxis,
  ResetTool: D3PResetTool,
  ScatterRenderer: D3PScatterRenderer,
  Series: D3PSeries,
  Slot: D3PSlot,
  Stack: D3PStack,
  Title: D3PTitle,
  Toolbox: D3PToolbox,
  Tooltip: D3PTooltip,
  TooltipContainer: D3PTooltipContainer,
  TooltipManager: D3PTooltipManager,
  Waterfall: D3PWaterfall,
  WheelPanTool: D3PWheelPanTool,
  WheelZoomTool: D3PWheelZoomTool,
  ZoomSelectionTool: D3PZoomSelectionTool,
} as const

type Options<C extends new (options: any) => unknown> = Omit<NonNullable<ConstructorParameters<C>[0]>, 'bus'>

/** `new` of a class, without the bus: the options are optional when the class does not need any. */
type D3PFactory<C extends new (options: any) => unknown> = {} extends Options<C> ? (options?: Options<C>) => InstanceType<C> : (options: Options<C>) => InstanceType<C>

/**
 * Makes the objects of a chart with a bus given once, and destroys them together. `ctx.newSeries({...})`
 * does what `new D3PSeries({ bus, ... })` does, for every object of the library, and the object is
 * destroyed with the context. Objects you make yourself are handed to `destroyLater`.
 *
 * Made by {@link d3pContext}. In Vue and React, `useD3PContext()` makes one that is destroyed when the
 * component goes away.
 */
export type D3PContext = {
  /** The bus the objects are made with. */
  readonly bus: D3PBus
  /**
   * Destroys `object` with the context. Everything made by the context is already; this is for what you
   * made yourself (`new D3PSeries({ bus })`). Returns the object.
   */
  destroyLater<T extends D3PDestroyable>(object: T): T
  /**
   * Destroys everything the context made or was given, the last one first (a renderer before its series).
   * The context can be used again afterwards.
   */
  destroy(): void
} & { readonly [K in keyof typeof FACTORIES as `new${K}`]: D3PFactory<(typeof FACTORIES)[K]> }

/**
 * A context for `bus` (the global bus by default): `ctx.newAxis({...})` for `new D3PAxis({ bus, ... })`, and so on
 * for every object, and `ctx.destroy()` to destroy them all.
 */
export function d3pContext(bus: D3PBus = getGlobalBus()): D3PContext {
  let owned: D3PDestroyable[] = []
  const context: Record<string, unknown> = {
    bus,
    destroyLater: <T extends D3PDestroyable>(object: T): T => {
      owned.push(object)
      return object
    },
    destroy: () => {
      const list = owned.reverse()
      owned = []
      for (const object of list) {
        try {
          object.destroy()
        } catch (error) {
          console.error('[d3pict] an object failed to be destroyed', error)
        }
      }
    },
  }
  for (const [name, Class] of Object.entries(FACTORIES)) {
    context[`new${name}`] = (options: object = {}) => (context.destroyLater as (o: D3PDestroyable) => D3PDestroyable)(new (Class as new (o: object) => D3PDestroyable)({ ...options, bus }))
  }
  return context as D3PContext
}
