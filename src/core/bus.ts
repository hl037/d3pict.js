/**
 * Typed symbol events and the asynchronous event bus.
 *
 * An event is a unique `Symbol` carrying a phantom payload type. Two objects can only
 * talk if they own the same symbol, which gives per-owner isolation without magic strings.
 */

export type D3PEvent<P = void> = symbol & { readonly __payload?: P }

/**
 * Creates an event: a unique symbol, typed by its payload, that can be emitted and listened to on a bus.
 */
export function d3pEvent<P = void>(description?: string): D3PEvent<P> {
  return Symbol(description) as D3PEvent<P>
}

/** Table `name -> event` as owned by an emitter. */
export type D3PEventTable<M> = { readonly [K in keyof M]: D3PEvent<M[K]> }

/**
 * Creates one event for each name, for an owner: `table.name` is the symbol to emit and to listen to.
 */
export function d3pEventTable<M>(owner: string, names: readonly (keyof M & string)[]): D3PEventTable<M> {
  const out: Record<string, symbol> = {}
  for (const n of names) out[n] = d3pEvent(`${owner}.${n}`)
  return out as unknown as D3PEventTable<M>
}

/** A function that receives the payload of an event. */
export type D3PHandler<P> = (payload: P) => unknown
/** A function that receives every event of a bus, with its symbol and its payload. */
export type D3PWildcardHandler = (event: symbol, payload: unknown) => unknown
/** Removes a subscription when called. */
export type D3PUnsubscribe = () => void

/**
 * Asynchronous bus.
 *
 * - `emit` never runs a handler synchronously: delivery happens in a later microtask.
 * - Deliveries start in `emit` order (FIFO). Handlers of one delivery run in subscription
 *   order, specific handlers before wildcard ones.
 * - The handler list is snapshotted at delivery time, so (un)subscribing from a handler is safe.
 * - A failing handler is reported with `console.error` and never prevents the others from running.
 * - `emit` returns a promise settled once every handler has completed; `idle()` waits for all
 *   in-flight deliveries (including those triggered by handlers).
 */
export class D3PBus {
  private handlers = new Map<symbol, Set<D3PHandler<any>>>()
  private wildcards = new Set<D3PWildcardHandler>()
  private pending = new Set<Promise<void>>()

  /** Calls `handler` each time `event` is emitted. Returns the function that removes it. */
  on<P>(event: D3PEvent<P>, handler: D3PHandler<P>): D3PUnsubscribe {
    let set = this.handlers.get(event)
    if (!set) this.handlers.set(event, (set = new Set()))
    set.add(handler)
    return () => this.off(event, handler)
  }

  /** Whether anything listens to `event` (the wildcard handlers do not count). */
  hasHandlers(event: symbol): boolean {
    return this.handlers.has(event)
  }

  /** Subscribe once; the handler is removed before its first call. */
  once<P>(event: D3PEvent<P>, handler: D3PHandler<P>): D3PUnsubscribe {
    const off = this.on(event, (p) => {
      off()
      return handler(p)
    })
    return off
  }

  /** Removes a handler that was added with `on`. */
  off<P>(event: D3PEvent<P>, handler: D3PHandler<P>): void {
    const set = this.handlers.get(event)
    if (!set) return
    set.delete(handler)
    if (!set.size) this.handlers.delete(event)
  }

  /** Calls `handler` for every event of the bus, with its symbol and its payload. */
  onAny(handler: D3PWildcardHandler): D3PUnsubscribe {
    this.wildcards.add(handler)
    return () => this.wildcards.delete(handler)
  }

  /**
   * Emits an event. Handlers run later, in a microtask, in the order of the emits. The promise is resolved when they all ran.
   */
  emit<P>(event: D3PEvent<P>, ...args: P extends void ? [] : [payload: P]): Promise<void>
  emit(event: symbol, payload?: unknown): Promise<void> {
    const delivery = Promise.resolve().then(() => this.deliver(event, payload))
    this.pending.add(delivery)
    const done = () => this.pending.delete(delivery)
    delivery.then(done, done)
    return delivery
  }

  /** Resolves when no delivery is in flight (also covers deliveries emitted by handlers). */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending])
  }

  private deliver(event: symbol, payload: unknown): Promise<void> {
    const specific = [...(this.handlers.get(event) ?? [])]
    const wild = [...this.wildcards]
    const results: Promise<void>[] = []
    const run = (fn: () => unknown) => {
      try {
        const r = fn()
        if (r && typeof (r as PromiseLike<unknown>).then === 'function') results.push(Promise.resolve(r).then(undefined, report))
      } catch (e) {
        report(e)
      }
    }
    for (const h of specific) run(() => h(payload))
    for (const h of wild) run(() => h(event, payload))
    return Promise.all(results).then(() => undefined)
  }
}

function report(e: unknown) {
  console.error('[d3pict] event handler failed', e)
}

// ---------------------------------------------------------------------------
// Global bus
// ---------------------------------------------------------------------------

let globalBus: D3PBus | undefined
let provider: () => D3PBus = () => (globalBus ??= new D3PBus())

/**
 * Layer a resolver over the global bus (e.g. one bus per application in a framework adapter).
 * The resolver returns `undefined` when it has no answer in the current context (outside a
 * component, say); the previously installed resolver then answers, down to the shared default.
 */
export function setGlobalBusProvider(resolve: () => D3PBus | undefined) {
  const previous = provider
  provider = () => resolve() ?? previous()
}

/** The bus shared by default by every object that is not given one. */
export function getGlobalBus(): D3PBus {
  return provider()
}

/** Collects unsubscribe functions to release them all at once. */
export class D3PSubscriptions {
  private list: D3PUnsubscribe[] = []
  /** Keeps a way to unsubscribe, to release it later with `clear`. Returns it unchanged. */
  add(off: D3PUnsubscribe): D3PUnsubscribe {
    this.list.push(off)
    return off
  }
  /** Calls and forgets every unsubscribe function that was added. */
  clear() {
    const l = this.list
    this.list = []
    for (const off of l) off()
  }
}
