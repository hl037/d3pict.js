import type { D3PChart } from '../chart'
import type { D3PCoordinateSystem } from '../coords'
import type { D3PPixelPoint } from '../series'
import type { D3PScale } from '../util'
import { type D3PSeriesRendererOptions } from './base'
import { D3PPathRenderer, type D3PPathStyle } from './path'

/** Props of a line: its style (color, width, curve, gaps). */
export interface D3PLineProps {
  /** The style: the color, the width of the line, the curve and the gaps. */
  style: D3PPathStyle & { strokeWidth: number }
}

/**
 * A line through the points of a series, in any coordinate system. The style gives its color, its width, its curve and what to do with missing values.
 */
export class D3PLineRenderer extends D3PPathRenderer<D3PLineProps> {
  protected readonly pathClass = 'line'

  constructor(opts: D3PSeriesRendererOptions<D3PLineProps>) {
    super(opts, { style: { color: '', strokeWidth: 2, curve: 'linear', gaps: 'connect', closed: false } })
  }

  protected pathStyle(props: D3PLineProps, hidden: boolean) {
    return {
      fixed: { fill: 'none', stroke: props.style.color },
      animated: { 'stroke-width': hidden ? 0 : props.style.strokeWidth },
    }
  }

  /** The generator of the line, in any system. */
  protected pathGenerator(chart: D3PChart, system: D3PCoordinateSystem, _sy: D3PScale) {
    const curve = this.props.style.curve
    return (pts: D3PPixelPoint[]) => system.linePath(chart, pts, curve)
  }
}
