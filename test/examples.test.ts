import { afterEach, describe, expect, it } from 'vitest'
import { d3pSettle, getGlobalBus } from '../src'
import { examples, type Framework } from '../examples/registry'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))
afterEach(() => (document.body.innerHTML = ''))

const FRAMEWORKS: Framework[] = ['core', 'vue', 'react']
const CHARTS: Record<string, number> = { lines: 1, tools: 1, synced: 2, polar: 1, pie: 1, gallery: 1, axes: 1, polarsync: 2, showcase: 7, titles: 1, many: 1, data: 1 }

describe.each(examples.filter((e) => !e.hidden))('example $id', (example) => {
  it.each(FRAMEWORKS)('mounts and unmounts with %s', async (fw) => {
    const root = document.createElement('div')
    document.body.append(root)
    const errors: unknown[] = []
    const origError = console.error
    console.error = (...a) => void errors.push(a)
    try {
      const dispose = (await example.load[fw]())(root)
      await wait()
      await d3pSettle(getGlobalBus())
      await wait()
      expect(root.querySelectorAll('svg').length).toBe(CHARTS[example.id])
      if (example.id !== 'pie' && example.id !== 'gallery') expect(root.querySelectorAll('[class*="axis"]').length).toBeGreaterThan(0) // a pie has no axes
      expect(root.querySelector('path')).toBeTruthy()
      // tools, cursor and tooltip need an interaction area, whatever the framework
      expect(root.querySelectorAll('rect.interaction-area').length).toBe(CHARTS[example.id])
      dispose()
      await wait()
      expect(root.querySelector('svg')).toBeNull()
      expect(errors).toEqual([])
    } finally {
      console.error = origError
    }
  })
})

describe('a step of the guide', () => {
  it.each(FRAMEWORKS)('mounts and unmounts with %s', async (fw) => {
    for (const id of ['guide-1', 'guide-5', 'guide-10']) {
      const example = examples.find((e) => e.id === id)!
      const root = document.createElement('div')
      document.body.append(root)
      const dispose = (await example.load[fw]())(root)
      await wait()
      await d3pSettle(getGlobalBus())
      await wait()
      expect(root.querySelectorAll('svg').length).toBe(1)
      dispose()
      await wait()
      expect(root.querySelector('svg')).toBeNull()
    }
  })
})

describe('a chart type page', () => {
  it.each(FRAMEWORKS)('mounts and unmounts with %s', async (fw) => {
    const example = examples.find((e) => e.id === 'type-curves')!
    const root = document.createElement('div')
    document.body.append(root)
    const dispose = (await example.load[fw]())(root)
    await wait()
    await d3pSettle(getGlobalBus())
    await wait()
    expect(root.querySelectorAll('svg').length).toBe(1)
    expect(root.querySelectorAll('rect.interaction-area').length).toBe(1)
    dispose()
    await wait()
    expect(root.querySelector('svg')).toBeNull()
  })
})
