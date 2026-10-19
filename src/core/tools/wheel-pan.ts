import type { D3PChart } from '../chart'
import type { D3PSubscriptions } from '../bus'
import type { D3PWheelEvent } from '../pointer'
import { d3pIsInvertible, d3pToNumber } from '../util'
import { D3PTool, d3pLike, type D3PToolOptions } from './base'

/**
 * Options of the wheel pan: those of a tool, and the part of the domain a step moves it by (`panFactor`).
 */
export interface D3PWheelPanToolOptions extends D3PToolOptions {
  /** Fraction of the domain width scrolled per wheel notch (default 0.1). */
  panFactor?: number
}

/**
 * Pan with the wheel (`name: 'wheel-pan'`): scrolling down moves toward higher values. A wheel
 * has a single scroll direction, so without an explicit `axes` filter only the X axes move.
 */
export class D3PWheelPanTool extends D3PTool {
  /** The part of the domain that one step of the wheel moves it by. */
  panFactor: number

  constructor(opts: D3PWheelPanToolOptions = {}) {
    super('wheel-pan', [], opts)
    this.panFactor = opts.panFactor ?? 0.1
  }

  protected createData() {
    return {}
  }

  private panAxes(chart: D3PChart) {
    const axes = this.resolveAxes(chart)
    return this.axes ? axes : axes.filter((a) => a.component === 'x')
  }

  protected attached(chart: D3PChart, _data: {}, subs: D3PSubscriptions): void {
    subs.add(
      this.bus.on(chart.event('wheel'), (p: D3PWheelEvent) => {
        if (!this.isActiveOn(chart)) return
        for (const axis of this.panAxes(chart)) {
          const scale = axis.getScale(chart)
          const d = axis.domain.domain
          if (!scale || !d3pIsInvertible(scale) || d.length !== 2) continue
          const a = d3pToNumber(d[0])
          const b = d3pToNumber(d[1])
          if (a === undefined || b === undefined) continue
          const shift = (p.delta > 0 ? 1 : -1) * (b - a) * this.panFactor
          axis.domain.domain = [d3pLike(d[0], a + shift), d3pLike(d[1], b + shift)]
        }
      }),
    )
    this.requireArea(chart)
  }
}
