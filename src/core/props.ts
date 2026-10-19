/**
 * A type whose fields, and the fields of its objects, are optional. Arrays and functions stay as they are.
 */
export type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

/**
 * Callable mergeable props: `p.a.b` reads, `p({a:{b:1}})` deep-merges, and the owner's
 * `set props(v)` calls `replace`.
 */
export type D3PProps<T extends object> = T & ((partial: DeepPartial<T>) => D3PProps<T>)

/**
 * What an owner does around a change of its props: `beforeSet` can cancel it, `afterSet` reacts to it.
 */
export interface D3PPropsHooks<T extends object> {
  /** Return `true` to cancel the operation. */
  beforeSet?(info: { oldVal: T; newVal: unknown; merging: boolean }): boolean | void
  /** Called after a change, with the props. */
  afterSet?(props: D3PProps<T>): void
}

function isPlain(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function deepMerge(target: Record<string, any>, source: Record<string, any>) {
  for (const key of Object.keys(source)) {
    const v = source[key]
    if (v === undefined) continue
    if (isPlain(v) && isPlain(target[key])) deepMerge(target[key], v)
    else target[key] = isPlain(v) ? deepMerge({}, v) : v
  }
  return target
}

/** The props of an object and what is needed to use them: read, merge, replace or reset them. */
export interface D3PPropsHandle<T extends object> {
  props: D3PProps<T>
  /** Replace the whole content (all current keys are removed first). */
  replace(source: DeepPartial<T> | T): void
}

/**
 * Creates the props of an object from their defaults: a value that is read, merged into (`props({...})`) or assigned field by field, and that tells the owner when it changed.
 */
export function createProps<T extends object>(defaults: T, hooks: D3PPropsHooks<T> = {}): D3PPropsHandle<T> {
  const data = deepMerge({}, defaults as Record<string, any>) as T & Record<string, any>

  // Arrow function target: no `prototype`, so the Proxy invariants stay satisfiable.
  const target = ((partial: DeepPartial<T>) => {
    if (hooks.beforeSet?.({ oldVal: data, newVal: partial, merging: true })) return proxy
    deepMerge(data, partial as Record<string, any>)
    hooks.afterSet?.(proxy)
    return proxy
  }) as unknown as D3PProps<T>

  const proxy: D3PProps<T> = new Proxy(target, {
    get: (_t, k) => Reflect.get(data, k),
    set: (_t, k, v) => {
      if (hooks.beforeSet?.({ oldVal: data, newVal: { [k]: v }, merging: true })) return true
      Reflect.set(data, k, v)
      hooks.afterSet?.(proxy)
      return true
    },
    has: (_t, k) => Reflect.has(data, k),
    ownKeys: () => Reflect.ownKeys(data),
    getOwnPropertyDescriptor: (_t, k) => {
      const d = Reflect.getOwnPropertyDescriptor(data, k)
      return d && { ...d, configurable: true }
    },
  })

  return {
    props: proxy,
    replace(source) {
      if (hooks.beforeSet?.({ oldVal: data, newVal: source, merging: false })) return
      for (const k of Object.keys(data)) delete (data as any)[k]
      deepMerge(data, source as Record<string, any>)
      hooks.afterSet?.(proxy)
    },
  }
}
