import type { D3PBus } from './bus'
import { D3PObject } from './object'
import { createProps, type D3PProps, type DeepPartial } from './props'
import type { D3PDomainValue } from './util'

/** Limits that a domain does not leave (for a zoom or a pan): a minimum and a maximum. */
export interface D3PDomainBounds {
  /** The smallest value a domain can reach. */
  min?: number
  /** The largest value a domain can reach. */
  max?: number
}

/**
 * Props of a domain: the constraints on its lower and upper ends (`rangeMinConstraints`, `rangeMaxConstraints`).
 */
export interface D3PAxisDomainProps {
  /** Bounds of the first domain element. */
  rangeMinConstraints: D3PDomainBounds
  /** Bounds of the second domain element. */
  rangeMaxConstraints: D3PDomainBounds
}

/** Options of a domain: the values it covers, its props and the bus. */
export interface D3PAxisDomainOptions {
  /** The bus the domain uses (the global bus by default). */
  bus?: D3PBus
  /**
   * The values it covers at first: `[min, max]` for numbers and dates, the list of categories for a band axis.
   */
  domain?: Iterable<D3PDomainValue>
  /** Initial props: the constraints on the ends of the domain. */
  props?: DeepPartial<D3PAxisDomainProps>
}

/**
 * Shareable view state. Several axes (of several charts) may reference one domain: that is
 * how views are synchronized. It knows nothing about scales, charts or pixels.
 */
export class D3PAxisDomain extends D3PObject<{ domainChanged: D3PDomainValue[] }> {
  private current: D3PDomainValue[]
  private readonly propsHandle = createProps<D3PAxisDomainProps>(
    { rangeMinConstraints: {}, rangeMaxConstraints: {} },
    { afterSet: () => this.domain = this.current },
  )

  constructor(opts: D3PAxisDomainOptions = {}) {
    super('domain', ['domainChanged'], opts.bus)
    this.current = [...(opts.domain ?? [0, 1])]
    if (opts.props) this.propsHandle.props(opts.props)
    this.current = this.constrain(this.current)
  }

  /** The props of the domain: the constraints that zooming and panning respect. */
  get props(): D3PProps<D3PAxisDomainProps> {
    return this.propsHandle.props
  }
  /** Merges props into those of the domain. */
  set props(v: DeepPartial<D3PAxisDomainProps>) {
    this.propsHandle.replace(v)
  }

  /** A copy: the internal array is never exposed. */
  get domain(): D3PDomainValue[] {
    return [...this.current]
  }

  /** Sets the values it covers, within the constraints. Every axis that shares the domain follows. */
  set domain(value: Iterable<D3PDomainValue>) {
    this.current = this.constrain([...value])
    this.fire(this.e.domainChanged, [...this.current])
  }

  private constrain(d: D3PDomainValue[]): D3PDomainValue[] {
    const out = [...d]
    const clamp = (i: number, b: D3PDomainBounds) => {
      let v = out[i]
      if (typeof v !== 'number') return
      if (b.min !== undefined && v < b.min) v = b.min
      if (b.max !== undefined && v > b.max) v = b.max
      out[i] = v
    }
    clamp(0, this.props.rangeMinConstraints)
    clamp(1, this.props.rangeMaxConstraints)
    return out
  }
}
