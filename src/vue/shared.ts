import { getCurrentInstance, getCurrentScope, inject, onScopeDispose, ref, watch, type InjectionKey } from 'vue'
import { d3pContext, getGlobalBus, type D3PBus, type D3PChart, type D3PContext } from '../index'

/** Anything with `addToChart` / `removeFromChart` / `destroy`. */
export interface D3PAttachableLike {
  /** Attaches the object to a chart. */
  addToChart(chart: D3PChart): void
  /** Detaches the object from a chart. */
  removeFromChart(chart: D3PChart): void
}

/** The key under which the Vue plugin provides the bus of the app. */
export const D3P_BUS_KEY: InjectionKey<D3PBus> = Symbol('d3pict.bus')

/** The bus provided by the plugin. Throws when called outside `setup` or without the plugin. */
export function useD3PBus(): D3PBus {
  if (!getCurrentInstance()) throw new Error('[d3pict] useD3PBus() must be called inside setup()')
  const bus = inject(D3P_BUS_KEY, undefined)
  if (!bus) throw new Error('[d3pict] the D3PVPlugin is not installed on this app')
  return bus
}

/**
 * A context that makes the objects of a chart with the bus of the app (`ctx.newSeries({...})` for
 * `new D3PSeries({ bus, ... })`, and so on for every object) and destroys them when the component goes away.
 * `ctx.destroyLater(object)` adds an object you made yourself. Call it in `setup()`.
 */
export function useD3PContext(): D3PContext {
  const context = d3pContext(useD3PBus())
  if (getCurrentScope()) onScopeDispose(() => context.destroy())
  return context
}

/** The bus of the current component's app, or `undefined` outside a component / without the plugin. */
export function injectedBus(): D3PBus | undefined {
  return getCurrentInstance() ? inject(D3P_BUS_KEY, undefined) : undefined
}

/** Bus of the enclosing app, or the global one outside of any component. */
export function busOf(explicit?: D3PBus): D3PBus {
  if (explicit) return explicit
  return injectedBus() ?? getGlobalBus()
}

/**
 * Reactive counter bumped whenever one of the listed bus events fires. The source is re-read
 * when it changes, so a view whose prop is replaced follows the new object.
 */
export function useBusTick(source: () => { bus: D3PBus; events: symbol[] }) {
  const tick = ref(0)
  watch(
    source,
    ({ bus, events }, _previous, onCleanup) => {
      const offs = events.map((e) => bus.on(e as never, () => void tick.value++))
      onCleanup(() => offs.forEach((o) => o()))
      tick.value++ // the new object may already have something to show
    },
    { immediate: true },
  )
  return tick
}
