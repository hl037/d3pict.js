import { D3PBus, d3pEvent, getGlobalBus } from './bus'

/** Something objects are drawn on, as a chart. */
export interface D3PRenderTarget {
  /** Set when the target is being destroyed: nothing is drawn on it then. */
  isDestroying: boolean
}

/** An object that can be drawn on a target when it is asked to. */
export interface D3PRenderable<T extends D3PRenderTarget = any> {
  /** Set when the object is being destroyed: it is not drawn then. */
  isDestroying: boolean
  /** Draws the object on the target. */
  render(target: T): void | Promise<void>
}

/** A request to draw an object again: the target and the object. */
export interface D3PDirtyPayload {
  /** Where to draw it. */
  target: D3PRenderTarget
  /** The object to draw. */
  renderable: D3PRenderable
}

/** Global symbol: an object that must be redrawn on `target` announces it with this event. */
export const D3P_DIRTY = d3pEvent<D3PDirtyPayload>('dirty')

const managers = new WeakMap<D3PBus, D3PRenderManager>()

/**
 * Batches redraws. `dirty` requests are de-duplicated per `(target, renderable)` and executed
 * once per animation frame (falling back to a macro-task outside the browser). Renderables
 * must read their state at `render` time, never copy it.
 */
export class D3PRenderManager {
  private queue = new Map<D3PRenderTarget, Set<D3PRenderable>>()
  private scheduled: (() => void) | undefined
  private off: () => void

  constructor(/** The bus whose redraw requests it gathers. */ readonly bus: D3PBus) {
    this.off = bus.on(D3P_DIRTY, ({ target, renderable }) => this.enqueue(target, renderable))
  }

  private enqueue(target: D3PRenderTarget, renderable: D3PRenderable) {
    if (target.isDestroying) return
    let set = this.queue.get(target)
    if (!set) this.queue.set(target, (set = new Set()))
    set.add(renderable)
    this.schedule()
  }

  private schedule() {
    if (this.scheduled) return
    let handle: unknown
    let raf = false
    const run = () => {
      this.scheduled = undefined
      void this.flush()
    }
    if (typeof requestAnimationFrame === 'function') {
      raf = true
      handle = requestAnimationFrame(run)
    } else handle = setTimeout(run, 0)
    this.scheduled = () => (raf ? cancelAnimationFrame(handle as number) : clearTimeout(handle as any))
  }

  /** Whether something is waiting to be drawn. */
  get hasPending(): boolean {
    return this.queue.size > 0
  }

  /** Run every pending render now. */
  async flush(): Promise<void> {
    this.scheduled?.()
    this.scheduled = undefined
    const batch = this.queue
    this.queue = new Map()
    for (const [target, set] of batch) {
      if (target.isDestroying) continue
      for (const r of set) {
        if (r.isDestroying) continue
        try {
          await r.render(target)
        } catch (e) {
          console.error('[d3pict] render failed', e)
        }
      }
    }
  }

  /** Stops the manager and drops what is waiting. */
  destroy() {
    this.off()
    this.scheduled?.()
    this.scheduled = undefined
    this.queue.clear()
    managers.delete(this.bus)
  }
}

/**
 * The render manager of a bus: it gathers the redraw requests and runs them once per animation frame.
 */
export function getRenderManager(bus: D3PBus): D3PRenderManager {
  let m = managers.get(bus)
  if (!m) managers.set(bus, (m = new D3PRenderManager(bus)))
  return m
}

/** Create the render manager of a bus (default: the global one). Idempotent. */
export function d3pInit(bus: D3PBus = getGlobalBus()): D3PRenderManager {
  return getRenderManager(bus)
}

/** Asks for an object to be drawn again on a target, at the next frame. */
export function emitDirty(bus: D3PBus, payload: D3PDirtyPayload): void {
  getRenderManager(bus)
  void bus.emit(D3P_DIRTY, payload)
}

/**
 * Wait until the bus is quiet and every scheduled render ran (renders may emit new events,
 * so this loops). Mostly useful in tests and for "export once drawn" flows.
 */
export async function d3pSettle(bus: D3PBus = getGlobalBus()): Promise<void> {
  const m = getRenderManager(bus)
  for (let i = 0; i < 50; i++) {
    await bus.idle()
    if (!m.hasPending) return
    await m.flush()
  }
}
