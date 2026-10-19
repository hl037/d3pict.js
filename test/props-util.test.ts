import { describe, expect, it } from 'vitest'
import * as d3 from 'd3'
import { createProps, d3pInterpolateSeries, d3pScaleProjectFrom, d3pMergeArray, d3pNormalizeSeries, d3pScaleFactory, d3pScaleProjectTo } from '../src'

const placed = (points: [number, number][], keys = points.map((p) => p[0])) => ({ keys, points })

describe('props', () => {
  it('reads, merges deeply (ignoring undefined, replacing arrays) and replaces', () => {
    const calls: string[] = []
    const { props, replace } = createProps({ a: { b: 1, c: 2 }, list: [1, 2], keep: 'x' }, { afterSet: () => void calls.push('after') })
    expect(props.a.b).toBe(1)
    props({ a: { b: 5 }, list: [9], keep: undefined })
    expect(props.a).toEqual({ b: 5, c: 2 })
    expect(props.list).toEqual([9])
    expect(props.keep).toBe('x')
    replace({ a: { b: 0, c: 0 } } as any)
    expect(Object.keys(props)).toEqual(['a'])
    expect(calls).toEqual(['after', 'after'])
  })

  it('cancels with beforeSet', () => {
    const { props } = createProps({ v: 1 }, { beforeSet: () => true })
    props({ v: 2 })
    expect(props.v).toBe(1)
  })

  it('does not share nested defaults between instances', () => {
    const defaults = { n: { v: 1 } }
    const a = createProps(defaults)
    a.props({ n: { v: 2 } })
    expect(defaults.n.v).toBe(1)
  })
})

describe('mergeArray', () => {
  it('diffs by identity', () => {
    const [a, b, c] = [{}, {}, {}]
    const enter: object[] = []
    const exit: object[] = []
    const r = d3pMergeArray([a, b], [b, c]).enter((v) => enter.push(v)).exit((v) => exit.push(v))
    expect(enter).toEqual([c])
    expect(exit).toEqual([a])
    expect(r.value()).toEqual([c, b])
  })
})

describe('scales', () => {
  it('inverts continuous scales and band/point scales', () => {
    const lin = d3pScaleFactory('linear', { domain: [0, 10], range: [0, 100] })
    expect(d3pScaleProjectFrom(lin, 50)).toBe(5)
    const band = d3.scaleBand().domain(['a', 'b', 'c']).range([0, 300]).paddingInner(0.2).paddingOuter(0.1)
    for (const d of ['a', 'b', 'c']) expect(d3pScaleProjectFrom(band, (band(d) as number) + band.bandwidth() / 2)).toBe(d)
    expect(d3pScaleProjectFrom(band, -5)).toBeUndefined()
    expect(d3pScaleProjectTo(band, 'a')).toBe((band('a') as number) + band.bandwidth() / 2)
    const pt = d3.scalePoint().domain(['a', 'b']).range([0, 100])
    expect(d3pScaleProjectFrom(pt, 90)).toBe('b')
  })

  it('rejects unknown scale types', () => {
    expect(() => d3pScaleFactory('nope' as any, { domain: [0, 1], range: [0, 1] })).toThrow()
  })
})

describe('series', () => {
  it('normalizes formats, detecting on the first element and filtering incomplete objects', () => {
    expect(d3pNormalizeSeries([5, 6])).toEqual([[0, 5], [1, 6]])
    expect(d3pNormalizeSeries([[1, 2]])).toEqual([[1, 2]])
    expect(d3pNormalizeSeries([{ x: 1, y: 2 }, { x: 3 }, { y: 4 }])).toEqual([[1, 2]])
    expect(d3pNormalizeSeries('nope')).toEqual([])
  })

  it('interpolates between lists of different lengths without jumps', () => {
    const f = d3pInterpolateSeries(placed([[0, 0], [10, 10]]), placed([[0, 0], [5, 5], [10, 10]]))
    expect(f.interpolatedFrom.length).toBe(f.interpolatedTo.length)
    expect(f.interpolatedTo).toEqual([[0, 0], [5, 5], [10, 10]])
    // the extra "from" point is born on its nearest neighbour
    expect(f.interpolatedFrom[1]).toEqual([0, 0])
    expect(f(1)).toEqual([[0, 0], [5, 5], [10, 10]])
    expect(f(0)).toEqual(f.interpolatedFrom)
  })

  it('grows from a baseline number and tolerates unsorted input', () => {
    const f = d3pInterpolateSeries(100, placed([[0, 10], [5, 20]]))
    expect(f(0)).toEqual([[0, 100], [5, 100]])
    expect(f(1)).toEqual([[0, 10], [5, 20]])
    const g = d3pInterpolateSeries(placed([[5, 1], [0, 1]]), placed([[0, 2], [5, 2], [9, 2]]))
    expect(g.interpolatedFrom.length).toBe(3)
  })
})
