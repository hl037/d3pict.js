import { D3PBus, d3pEvent, type D3PEvent, type D3PUnsubscribe } from './bus'

/**
 * Typed key of a service registered on a chart (or any registry). Replaces the
 * request/response-by-callback protocol, which cannot work on an asynchronous bus:
 * providers register themselves, consumers `get` synchronously and `watch` for changes.
 * Anyone can mint new keys, so the base library stays extensible.
 */
export type D3PServiceKey<T> = symbol & { readonly __service?: T }

/**
 * Creates the key of a service: a unique symbol typed by the service it names, to use with `chart.get` and `chart.provide`.
 */
export function d3pServiceKey<T>(description?: string): D3PServiceKey<T> {
  return Symbol(description) as D3PServiceKey<T>
}

/**
 * What `D3PServiceRegistry.changed` announces: the key of the service and its new value (undefined when it went away).
 */
export interface D3PServiceChange {
  /** The key of the service. */
  key: symbol
  /** The new service, or `undefined` when it went away. */
  service: unknown
}

/**
 * The services of a chart, by key: one object for each key (the axes, the renderers, the interaction area, the probe), that can be provided, read and watched.
 */
export class D3PServiceRegistry {
  private services = new Map<symbol, unknown>()
  /** Announced (asynchronously) each time a service appears, changes or disappears. */
  readonly changed: D3PEvent<D3PServiceChange>

  constructor(
    private readonly bus: D3PBus,
    label: string,
  ) {
    this.changed = d3pEvent(`${label}.services.changed`)
  }

  /** Registers a service. The watchers of the key are told, later. */
  provide<T>(key: D3PServiceKey<T>, service: T): void {
    if (this.services.get(key) === service) return
    this.services.set(key, service)
    void this.bus.emit(this.changed, { key, service })
  }

  /** Remove a service; when `service` is given it only applies if it is the registered one. */
  remove<T>(key: D3PServiceKey<T>, service?: T): void {
    if (!this.services.has(key)) return
    if (service !== undefined && this.services.get(key) !== service) return
    this.services.delete(key)
    void this.bus.emit(this.changed, { key, service: undefined })
  }

  /** The service of that key, or `undefined`. */
  get<T>(key: D3PServiceKey<T>): T | undefined {
    return this.services.get(key) as T | undefined
  }

  /** The service of that key. Throws an error if there is none. */
  require<T>(key: D3PServiceKey<T>): T {
    const s = this.get(key)
    if (s === undefined) throw new Error(`[d3pict] service ${String(key.description)} is not available`)
    return s
  }

  /**
   * Call `cb` with the current service now (if any) and on every later change.
   * The callback is idempotent-safe: it is never called twice in a row with the same value.
   */
  watch<T>(key: D3PServiceKey<T>, cb: (service: T | undefined) => void): D3PUnsubscribe {
    let last: T | undefined
    let first = true
    const fire = (s: T | undefined) => {
      if (!first && s === last) return
      first = false
      last = s
      cb(s)
    }
    const current = this.get(key)
    if (current !== undefined) fire(current)
    return this.bus.on(this.changed, (c) => {
      if (c.key === key) fire(this.get(key))
    })
  }
}
