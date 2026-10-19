import type { D3PAxis } from '../axis'
import type { D3PChart } from '../chart'
import type { D3PSubscriptions } from '../bus'
import type { D3PDomainValue } from '../util'
import { D3PTool, type D3PToolOptions } from './base'

/**
 * Restores the domains axes had when first seen by the tool (`name: 'reset'`). Axes added to
 * the chart after the tool was attached are remembered too, at the moment they appear.
 */
export class D3PResetTool extends D3PTool {
  private readonly initial = new Map<D3PAxis, D3PDomainValue[]>()

  constructor(opts: D3PToolOptions = {}) {
    super('reset', [], opts)
  }

  protected createData() {
    return {}
  }

  protected attached(chart: D3PChart, _data: {}, subs: D3PSubscriptions): void {
    this.remember(chart)
    subs.add(this.bus.on(chart.axes.e.axesListChanged, () => this.isActiveOn(chart) && this.remember(chart)))
  }

  private remember(chart: D3PChart) {
    for (const axis of this.resolveAxes(chart)) {
      if (!this.initial.has(axis)) this.initial.set(axis, axis.domain.domain)
    }
  }

  /** Restore the remembered domains of one chart, or of all attached charts. */
  reset(chart?: D3PChart): void {
    for (const c of chart ? [chart] : this.getCharts()) {
      for (const axis of this.resolveAxes(c)) {
        const d = this.initial.get(axis)
        if (d) axis.domain.domain = d
      }
    }
  }
}
