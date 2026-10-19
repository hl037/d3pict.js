import { describe, expect, it } from 'vitest'
import { D3PAutoDomain, D3PAxisDomain, D3PBus, D3PSeries, d3pColumnLayout, d3pNormalizeSeries } from '../src'

describe('d3pNormalizeSeries: input formats', () => {
  it('keeps the three historical formats', () => {
    expect(d3pNormalizeSeries([3, 5, 2])).toEqual([[0, 3], [1, 5], [2, 2]])
    expect(d3pNormalizeSeries([[0, 3], ['a', 5]])).toEqual([[0, 3], ['a', 5]])
    expect(d3pNormalizeSeries([{ x: 0, y: 3 }, { x: 1 }, { y: 2 }, { x: 2, y: null }])).toEqual([[0, 3]])
    expect(d3pNormalizeSeries([])).toEqual([])
    expect(d3pNormalizeSeries(undefined)).toEqual([])
  })

  it('reads typed arrays, iterables and column-oriented data', () => {
    expect(d3pNormalizeSeries(new Float64Array([1, 2]))).toEqual([[0, 1], [1, 2]])
    expect(d3pNormalizeSeries(new Set([[0, 1], [1, 2]]))).toEqual([[0, 1], [1, 2]])
    expect(d3pNormalizeSeries(new Map([[0, 5]]).entries())).toEqual([[0, 5]])
    expect(d3pNormalizeSeries({ x: [0, 1, 2], y: [5, 6, 7] })).toEqual([[0, 5], [1, 6], [2, 7]])
    expect(d3pNormalizeSeries({ t: [0, 1], v: [5, 6] }, { fields: { x: 't', y: 'v' } })).toEqual([[0, 5], [1, 6]])
  })

  it('maps object keys and accessors to columns', () => {
    const rows = [{ time: 1, price: 10 }, { time: 2, price: 12 }]
    expect(d3pNormalizeSeries(rows, { fields: { x: 'time', y: 'price' } })).toEqual([[1, 10], [2, 12]])
    expect(d3pNormalizeSeries(rows, { fields: { x: (r) => r.time * 10, y: (r, i) => r.price + i } })).toEqual([[10, 10], [20, 13]])
    // accessors also read positional rows
    expect(d3pNormalizeSeries([[1, 2]], { fields: { x: (r) => r[1], y: (r) => r[0] } })).toEqual([[2, 1]])
  })
})

describe('columns', () => {
  const OHLC = ['x', 'open', 'high', 'low', 'close']

  it('stores x, the primary column, then the others', () => {
    expect(d3pColumnLayout({ columns: OHLC, primary: 'close' })).toEqual({ input: OHLC, stored: ['x', 'close', 'open', 'high', 'low'] })
    expect(d3pColumnLayout({ columns: OHLC }).stored).toEqual(OHLC)
    expect(d3pColumnLayout().stored).toEqual(['x', 'y'])
  })

  it('reads positional rows by name, whatever the primary column', () => {
    const rows = [[1, 10, 14, 9, 12], [2, 12, 13, 11, 11.5]]
    expect(d3pNormalizeSeries(rows, { columns: OHLC, primary: 'close' })).toEqual([[1, 12, 10, 14, 9], [2, 11.5, 12, 13, 11]])
    expect(d3pNormalizeSeries(rows, { columns: OHLC })).toEqual(rows)
  })

  it('reads object rows and columns by name, and makes missing values NaN', () => {
    const rows = [{ x: 1, open: 10, high: 14, low: 9, close: 12 }, { x: 2, open: 12, high: 13, close: 11 }]
    const out = d3pNormalizeSeries(rows, { columns: OHLC })
    expect(out[0]).toEqual([1, 10, 14, 9, 12])
    expect(out[1][3]).toBeNaN() // low is missing
    expect(d3pNormalizeSeries({ x: [1], open: [10], high: [14], low: [9], close: [12] }, { columns: OHLC })).toEqual([[1, 10, 14, 9, 12]])
  })

  it('keeps array cells (outliers)', () => {
    expect(d3pNormalizeSeries([['a', 1, 2, 3, [9, 10]]], { columns: ['x', 'min', 'q1', 'q3', 'outliers'] })).toEqual([['a', 1, 2, 3, [9, 10]]])
  })

  it('rejects bad specs with explicit messages', () => {
    expect(() => d3pColumnLayout({ columns: ['x'] })).toThrow(/at least two columns/)
    expect(() => d3pColumnLayout({ columns: ['x', 'a', 'a'] })).toThrow(/duplicate column names/)
    expect(() => d3pColumnLayout({ columns: ['x', 'a'], primary: 'x' })).toThrow(/primary column "x"/)
    expect(() => d3pColumnLayout({ columns: ['x', 'a'], primary: 'nope' })).toThrow(/primary column "nope"/)
    expect(() => d3pNormalizeSeries([1, 2], { columns: OHLC })).toThrow(/plain numbers needs two columns/)
  })

  it('exposes them on the series', () => {
    const bus = new D3PBus()
    const s = new D3PSeries({ bus, name: 's', columns: OHLC, primary: 'close', data: [[1, 10, 14, 9, 12]] })
    expect(s.columns).toEqual(['x', 'close', 'open', 'high', 'low'])
    expect(s.inputColumns).toEqual(OHLC)
    expect(s.index('high')).toBe(3)
    expect(s.has('volume')).toBe(false)
    expect(s.column('high')).toEqual([14])
    expect(() => s.column('volume')).toThrow(/no column "volume"/)
    s.data = [[2, 1, 2, 0, 1]] // same layout when the data is replaced
    expect(s.data).toEqual([[2, 1, 1, 2, 0]])
    expect(() => new D3PSeries({ bus, name: 't', domainColumns: ['nope'] })).toThrow(/no column "nope"/)
  })
})

describe('auto domain with several columns', () => {
  const setup = (opts: Partial<ConstructorParameters<typeof D3PSeries>[0]> = {}) => {
    const bus = new D3PBus()
    const time = new D3PAxisDomain({ bus, domain: [0, 1] })
    const price = new D3PAxisDomain({ bus, domain: [0, 1] })
    const series = new D3PSeries({ bus, name: 's', columns: ['x', 'open', 'high', 'low', 'close'], data: [[0, 10, 14, 9, 12], [1, 12, 20, 11, 15]], ...opts })
    const auto = new D3PAutoDomain({ bus })
    return { bus, time, price, series, auto }
  }

  it('fits the second domain to every value column of a two-domain mapping', () => {
    const { time, price, series, auto } = setup()
    auto.linkSeries(series, [time, price])
    expect(time.domain).toEqual([0, 1])
    expect(price.domain).toEqual([9, 20]) // lows and highs, not only the open
  })

  it('leaves out columns that are not domain columns', () => {
    const { price, series, auto } = setup({ domainColumns: ['open', 'close'] })
    auto.linkSeries(series, [new D3PAxisDomain({ domain: [0, 1] }), price])
    expect(price.domain).toEqual([10, 15])
  })

  it('maps columns by name', async () => {
    const { bus, time, price, series, auto } = setup()
    const other = new D3PAxisDomain({ bus, domain: [0, 1] })
    auto.linkSeries(series, { x: time, high: price, low: other })
    expect(price.domain).toEqual([14, 20])
    expect(other.domain).toEqual([9, 11])
    expect(() => auto.linkSeries(series, { nope: time })).toThrow(/no column "nope"/)
    series.data = [[0, 1, 2, 3, 4]]
    await bus.idle()
    expect(price.domain).toEqual([2, 2]) // follows the data
  })

  it('flattens array cells into the extent', () => {
    const bus = new D3PBus()
    const d = new D3PAxisDomain({ bus, domain: [0, 1] })
    const s = new D3PSeries({ bus, name: 'b', columns: ['x', 'q1', 'q3', 'outliers'], data: [['a', 1, 3, [-5, 12]]] })
    new D3PAutoDomain({ bus }).linkSeries(s, [null, d])
    expect(d.domain).toEqual([-5, 12])
  })
})
