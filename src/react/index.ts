/**
 * The React adapter: a provider and the components that mount a chart, its tooltip, its legend and your own content.
 * @module d3pict/react
 */
import { createContext, createElement, Fragment, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  D3PBus, D3PChart, d3pAutoInteractionArea, d3pContext, d3pInit, d3pMergeArray, d3pTooltipText, getGlobalBus,
  type D3PAnchor, type D3PContext, type D3PChartOptions, type D3PLegend, type D3PLegendBundle, type D3PSlot, type D3PTooltip, type D3PTooltipData,
} from '../index'

/** Anything with `addToChart` / `removeFromChart`. */
export interface D3PAttachableLike {
  /** Attaches the object to a chart. */
  addToChart(chart: D3PChart): void
  /** Detaches the object from a chart. */
  removeFromChart(chart: D3PChart): void
}

const BusContext = createContext<D3PBus | undefined>(undefined)

/** Provide one bus (and render manager) to a React subtree; without it the global bus is used. */
export function D3PRProvider(props: { bus?: D3PBus; children?: ReactNode }): ReactNode {
  const [bus] = useState(() => props.bus ?? new D3PBus())
  d3pInit(bus)
  return createElement(BusContext.Provider, { value: bus }, props.children)
}

/** The bus of the app, from the nearest `D3PRProvider` (the global bus without one). */
export function useD3PBus(): D3PBus {
  return useContext(BusContext) ?? getGlobalBus()
}

/**
 * A context that makes the objects of a chart with the bus of the app (`ctx.newSeries({...})` for
 * `new D3PSeries({ bus, ... })`, and so on for every object) and destroys them when the component goes away.
 * `ctx.destroyLater(object)` adds an object you made yourself.
 *
 * Make the objects in an effect (`useEffect`), not while rendering: a component can render more than once, and
 * `StrictMode` mounts, unmounts and mounts it again, which destroys what the first mount made. The context
 * stays usable after that.
 */
export function useD3PContext(): D3PContext {
  const bus = useD3PBus()
  const context = useMemo(() => d3pContext(bus), [bus])
  useEffect(() => () => context.destroy(), [context])
  return context
}

/** Re-render the component whenever one of the given bus events is emitted. */
function useBusTick(bus: D3PBus, events: symbol[]) {
  const [, setTick] = useState(0)
  const tick = () => setTick((n) => n + 1)
  const key = events.map((e) => String(e.description)).join('|')
  useEffect(() => {
    const offs = events.map((e) => bus.on(e as never, () => tick()))
    return () => offs.forEach((o) => o())
    // events are stable symbols of long-lived objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus, key, ...events])
}

/**
 * Props of `D3PRChart`: the options of `D3PChart` (except the container), the bus, the objects to attach, a class name and a style for the `div`, and `onReady`, called with the chart.
 */
export interface D3PRChartProps extends Omit<D3PChartOptions, 'container' | 'bus'> {
  /** The bus the chart uses (the one of the provider by default). */
  bus?: D3PBus
  /** The objects to attach to the chart: axes, renderers, tools, the cursor... */
  objects?: D3PAttachableLike[]
  /** A class for the `div` of the chart. */
  className?: string
  /** A style for the `div` of the chart. */
  style?: CSSProperties
  /** Called with the chart once it is created and the objects are attached. */
  onReady?(chart: D3PChart): void
}

/**
 * Mounts a chart in a `div`, attaches `objects` to it, and removes them when it unmounts. The other props are the options of `D3PChart`.
 */
export function D3PRChart(props: D3PRChartProps): ReactNode {
  const ctxBus = useD3PBus()
  const bus = props.bus ?? ctxBus
  const el = useRef<HTMLDivElement>(null)
  const chartRef = useRef<D3PChart | undefined>(undefined)
  const attached = useRef<D3PAttachableLike[]>([])
  const objects = props.objects ?? []
  const objectsRef = useRef(objects)
  objectsRef.current = objects
  const onReady = useRef(props.onReady)
  onReady.current = props.onReady

  // chart lifecycle (re-created if the bus or the fixed geometry changes)
  useEffect(() => {
    const chart = new D3PChart({ container: el.current!, bus, width: props.width, height: props.height, margin: props.margin, name: props.name, resizeDebounceMs: props.resizeDebounceMs })
    chartRef.current = chart
    const disposeArea = d3pAutoInteractionArea(chart)
    attached.current = d3pMergeArray([], objectsRef.current).enter((o) => o.addToChart(chart)).value()
    onReady.current?.(chart)
    return () => {
      disposeArea()
      chart.destroy()
      chartRef.current = undefined
      attached.current = []
    }
  }, [bus, props.width, props.height, props.name, props.resizeDebounceMs])

  // object synchronisation
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    attached.current = d3pMergeArray(attached.current, objects)
      .exit((o) => o.removeFromChart(chart))
      .enter((o) => o.addToChart(chart))
      .value()
  })

  return createElement('div', { ref: el, className: props.className, style: { width: props.width ? undefined : '100%', height: props.height ? undefined : '100%', ...props.style } })
}

// ---------------------------------------------------------------------------
// Portals
// ---------------------------------------------------------------------------

/** Props of `D3PRTooltip`. */
export interface D3PRTooltipProps {
  /** The tooltip to show. */
  tooltip: D3PTooltip
  /** Renders the content of the tooltip from what was found under the pointer, for each chart. */
  children?: (data: D3PTooltipData, chart: D3PChart) => ReactNode
}

/**
 * Shows a tooltip in HTML, positioned by the library. `children` renders the content from the `D3PTooltipData`; without it, the standard content is used.
 */
export function D3PRTooltip({ tooltip, children }: D3PRTooltipProps): ReactNode {
  useBusTick(tooltip.manager.bus, [tooltip.manager.e.show, tooltip.manager.e.hide, tooltip.container.e.changed])
  return createElement(
    Fragment,
    null,
    tooltip.container
      .getContainers()
      .filter((c) => c.data)
      .map(({ chart, container, data }) => createPortal(children ? children(data!, chart) : defaultTooltip(data!), container, `${chart.id}`)),
  )
}

function defaultTooltip(data: D3PTooltipData): ReactNode {
  return createElement(
    'div',
    // a long list goes in columns, so the box does not grow taller than the chart
    { style: { background: '#fff', color: '#222', border: '1px solid #ccc', borderRadius: 4, padding: '4px 8px', font: '12px sans-serif', whiteSpace: 'nowrap', columnCount: Math.ceil(data.series.length / 12), columnGap: 16 } },
    data.series.map((s) =>
      createElement('div', { key: s.renderer.id, style: { breakInside: 'avoid' } }, [
        createElement('span', { key: 'dot', style: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 4 } }),
        d3pTooltipText(s),
      ]),
    ),
  )
}

/** Props of `D3PRLegend`. */
export interface D3PRLegendProps {
  /** The legend to show. */
  legend: D3PLegendBundle
  /** A style for the `div` of the legend. */
  style?: CSSProperties
  /** Renders the legend from what the series list, for each chart. */
  children?: (legend: D3PLegend, chart: D3PChart) => ReactNode
}

/**
 * Shows a legend in HTML. `children` renders it from the `D3PLegend` of the bundle; without it, the standard legend is used.
 */
export function D3PRLegend({ legend, style, children }: D3PRLegendProps): ReactNode {
  useBusTick(legend.manager.bus, [legend.manager.e.changed, legend.container.e.changed])
  return createElement(
    Fragment,
    null,
    legend.container.getContainers().map(({ chart, container, data }) =>
      createPortal(
        data ? (children ? children(data, chart) : defaultLegend(data, { position: 'absolute', top: 4, right: 4, maxHeight: 'calc(100% - 8px)', overflowY: 'auto', ...style })) : null,
        container,
        `${chart.id}`,
      ),
    ),
  )
}

function defaultLegend(legend: D3PLegend, style: CSSProperties): ReactNode {
  return createElement(
    'div',
    { style: { ...style, pointerEvents: 'auto', font: '12px sans-serif' } },
    legend.series.map((s) =>
      createElement(
        'div',
        { key: `${s.renderer.id}-${s.key}`, style: { cursor: 'pointer', opacity: s.visible ? 1 : 0.4 }, onClick: () => s.toggle() },
        [createElement('span', { key: 'dot', style: { display: 'inline-block', width: 10, height: 10, background: s.color, marginRight: 4 } }), s.label],
      ),
    ),
  )
}

/** Props of `D3PRSlot`. */
export interface D3PRSlotProps {
  /** The slot to put content in. */
  slot: D3PSlot
  /** What goes in the element of the slot of each chart. */
  children?: (chart: D3PChart) => ReactNode
}

/** Renders `children` in the element of a `D3PSlot`, for each chart it is attached to. */
export function D3PRSlot({ slot, children }: D3PRSlotProps): ReactNode {
  useBusTick(slot.bus, [slot.e.changed])
  const style: CSSProperties = { pointerEvents: 'auto', width: '100%', height: '100%' }
  return createElement(
    Fragment,
    null,
    slot.getContainers().map(({ chart, container }) => createPortal(createElement('div', { style }, children?.(chart)), container, `${chart.id}`)),
  )
}

/** Props of `D3PRAnchor`: the anchor, its box and the point of the box that sits on the anchor. */
export interface D3PRAnchorProps {
  /** The anchor that gives the container. */
  anchor: D3PAnchor
  /** Position of the box, in pixels from the left of the chart. */
  x?: number
  /** Position of the box, in pixels from the top of the chart. */
  y?: number
  /** Width of the box of the content, in pixels. */
  width?: number
  /** Height of the box of the content, in pixels. */
  height?: number
  /** Anchor point of the content in [-1, 1]: (-1,-1) top-left, (1,1) bottom-right. */
  point?: { x: number; y: number }
  /** Renders the content, for each chart the anchor is on. */
  children?: (chart: D3PChart) => ReactNode
}

/**
 * Puts React content at a point of the plot, in a chart's overlay (a label, a button). It follows the anchor object.
 */
export function D3PRAnchor({ anchor, x = 0, y = 0, width, height, point = { x: -1, y: -1 }, children }: D3PRAnchorProps): ReactNode {
  useBusTick(anchor.bus, [anchor.e.changed])
  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `translate(${-(0.5 + point.x * 0.5) * 100}%, ${-(0.5 + point.y * 0.5) * 100}%)`,
    pointerEvents: 'auto',
  }
  return createElement(
    Fragment,
    null,
    anchor.getContainers().map(({ chart, container }) => createPortal(createElement('div', { style }, children?.(chart)), container, `${chart.id}`)),
  )
}
