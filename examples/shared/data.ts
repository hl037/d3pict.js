// #region rng
/** Deterministic pseudo-random numbers so every framework shows the same data. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
// #endregion rng

// #region walk
/** Bounded random walk. */
export function walk(seed: number, n: number, start: number, step: number, min = 0, max = 100): number[] {
  const r = rng(seed)
  const out: number[] = []
  let v = start
  for (let i = 0; i < n; i++) {
    v = Math.min(max, Math.max(min, v + (r() - 0.5) * step))
    out.push(v)
  }
  return out
}
// #endregion walk

// #region timeSeries
/** One point per minute starting at a fixed date. */
export function timeSeries(values: number[], start = Date.UTC(2026, 0, 1)): [Date, number][] {
  return values.map((v, i) => [new Date(start + i * 60_000), v])
}
// #endregion timeSeries

// #region indexed
export function indexed(values: number[]): [number, number][] {
  return values.map((v, i) => [i, v])
}
// #endregion indexed
