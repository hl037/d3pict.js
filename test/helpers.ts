import { d3pProbe, D3PPointerEvent, D3PViewportPoint, type D3PChart, type D3PDomainValue, type D3PProbeHit, type D3PSeriesRenderer } from '../src'

/** A pointer event of `type` at pixel `(x, y)` of `chart`. */
export function pointer(chart: D3PChart, x: number, y: number, type = 'mousemove'): D3PPointerEvent {
  return new D3PPointerEvent(chart, x, y, new MouseEvent(type))
}

/** The domain value under pixel `(x, y)` for each axis of the chart, by axis name (`undefined` outside of its system). */
export function valuesAt(chart: D3PChart, x: number, y: number): Record<string, D3PDomainValue | undefined> {
  const point = new D3PViewportPoint(chart, x, y)
  const { x: xs, y: ys } = chart.axes.getAxesState()
  return Object.fromEntries([...xs, ...ys].map((axis) => [axis.name, axis.projectFrom(point)]))
}

/** What the renderer finds under pixel `(x, y)`. */
export function hitAt(chart: D3PChart, renderer: D3PSeriesRenderer, x: number, y: number): D3PProbeHit | undefined {
  return d3pProbe(chart).hit(pointer(chart, x, y), renderer)
}
