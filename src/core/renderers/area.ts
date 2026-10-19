import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem } from '../coords'
import type { D3PPixelPoint } from '../series'
import type { D3PScale } from '../util'
import { type D3PSeriesRendererOptions } from './base'
import { D3PPathRenderer, d3pBaseline, type D3PPathStyle } from './path'

/**
 * Props of an area: its style (color, opacity, curve) and the column it is drawn down to (`base`).
 */
export interface D3PAreaProps {
  /** The style: the color, the opacity of the fill, the curve and the gaps. */
  style: D3PPathStyle & { opacity: number }
  /**
   * Column of the series holding the base of the area: an area between two curves (a range
   * area), or a layer of a stack. Default: the `y0` column when the series has one, else the zero line.
   */
  base?: string
}

/**
 * An area between a series and its base: zero, or the column named by `props.base` (a range, a layer of a stack).
 */
export class D3PAreaRenderer extends D3PPathRenderer<D3PAreaProps> {
  protected readonly pathClass = 'area'

  constructor(opts: D3PSeriesRendererOptions<D3PAreaProps>) {
    super(opts, { style: { color: '', opacity: 0.5, curve: 'linear', gaps: 'connect', closed: false } })
  }

  protected pathStyle(props: D3PAreaProps, hidden: boolean) {
    return {
      fixed: { fill: props.style.color },
      animated: { opacity: hidden ? 0 : props.style.opacity },
    }
  }

  protected override checkColumns(series = this.series): void {
    super.checkColumns(series)
    const base = this.props.base
    if (base !== undefined && !series.has(base)) {
      throw new Error(`[d3pict] renderer "${this.name}": series "${series.name}" has no column "${base}" to use as the base of the area (columns: ${series.columns.join(', ')})`)
    }
  }

  protected override baseColumn(): string | undefined {
    return this.props.base ?? (this.series.has('y0') ? 'y0' : undefined)
  }

  /** The generator of the area: down to the base, in any system. */
  protected pathGenerator(chart: D3PChart, system: D3PCoordinateSystem, sy: D3PScale) {
    // The area is closed on the value 0 (computed once per render); when the scale cannot place 0 (log), use the baseline.
    const zero = (sy as any)(0) as number
    const b0 = Number.isFinite(zero) ? zero : d3pBaseline(sy)
    const { curve, closed } = this.props.style
    // a closed area is the filled outline (a radar), not the space down to a base
    if (closed) return (pts: D3PPixelPoint[]) => ((d) => (d ? `${d}Z` : null))(system.linePath(chart, pts, curve))
    return (pts: D3PPixelPoint[]) => system.areaPath(chart, pts, b0, curve)
  }
}
