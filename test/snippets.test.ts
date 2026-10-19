import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { createApp } from 'vue'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { D3PVPlugin } from '../src/vue'
import { d3pSettle, getGlobalBus } from '../src'
import { composeSnippet, type SnippetFramework } from '../examples/snippets/compose'
import { SNIPPETS } from '../examples/snippets/manifest'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false

/**
 * The code the documentation shows is assembled from tagged regions of the examples. Here every
 * snippet is written to a file, type-checked as an application would, and run: what is shown is
 * code that works, as it is.
 */
const DIR = join(import.meta.dirname, '.generated')
const EXT: Record<SnippetFramework, string> = { core: 'ts', vue: 'vue', react: 'tsx' }
const CHARTS: Record<string, number> = { lines: 1, tools: 1, synced: 2, polar: 1, pie: 1, axes: 1, polarsync: 2, showcase: 7, titles: 1, many: 1, data: 1 }
const charts = (id: string) => CHARTS[id] ?? 1 // the chart types have one
const file = (id: string, fw: SnippetFramework) => join(DIR, `${id}.${fw}.${EXT[fw]}`)
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms))

beforeAll(() => {
  rmSync(DIR, { recursive: true, force: true })
  mkdirSync(DIR, { recursive: true })
  for (const id of Object.keys(SNIPPETS)) {
    for (const fw of ['core', 'vue', 'react'] as const) writeFileSync(file(id, fw), composeSnippet(SNIPPETS[id], fw, true).code)
  }
})
afterAll(() => rmSync(DIR, { recursive: true, force: true }))
afterEach(() => (document.body.innerHTML = ''))

describe('the snippets', () => {
  it('type-check (core and React; a Vue file has no type-checker here)', () => {
    const root = join(import.meta.dirname, '..')
    const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), { noEmit: true }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)) } })!
    const files = Object.keys(SNIPPETS).flatMap((id) => [file(id, 'core'), file(id, 'react')])
    // the snippets import `./data` only when they do not carry their data: these do
    const program = ts.createProgram(files, { ...config.options, noEmit: true, skipLibCheck: true, baseUrl: root })
    const errors = ts.getPreEmitDiagnostics(program).filter((d) => d.file && files.includes(d.file.fileName))
    expect(errors.map((d) => `${d.file!.fileName.split('/').pop()}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)).toEqual([])
  })

  describe.each(Object.keys(SNIPPETS))('%s', (id) => {
    it('runs as plain code', async () => {
      document.body.innerHTML = '<div id="app" style="display:flex;width:800px;height:400px"></div>'
      await import(/* @vite-ignore */ file(id, 'core'))
      await d3pSettle(getGlobalBus())
      expect(document.querySelectorAll('#app svg').length).toBe(charts(id))
      expect(document.querySelector('#app path')).toBeTruthy()
    })

    it('runs as a Vue component', async () => {
      const host = document.createElement('div')
      document.body.append(host)
      const component = (await import(/* @vite-ignore */ file(id, 'vue'))).default
      const app = createApp(component).use(D3PVPlugin)
      app.mount(host)
      await wait()
      await d3pSettle(getGlobalBus())
      expect(host.querySelectorAll('svg').length).toBe(charts(id))
      app.unmount()
    })

    it('runs as a React component', async () => {
      const host = document.createElement('div')
      document.body.append(host)
      const { Example } = await import(/* @vite-ignore */ file(id, 'react'))
      const root = createRoot(host)
      root.render(createElement(Example))
      await wait(80)
      await d3pSettle(getGlobalBus())
      expect(host.querySelectorAll('svg').length).toBe(charts(id))
      root.unmount()
    })
  })

  it('can leave the data out, importing it from your own module', () => {
    const lean = composeSnippet(SNIPPETS.lines, 'core', false).code
    expect(lean).toContain("import { timeSeries, walk } from './data'")
    expect(lean).not.toContain('function walk')
    const full = composeSnippet(SNIPPETS.lines, 'core', true).code
    expect(full).toContain('function walk')
    expect(full).toContain('function rng') // what walk calls comes with it
    expect(full).not.toContain('./data')
    expect(composeSnippet(SNIPPETS.pie, 'core', false).code).not.toContain('./data') // nothing to generate
  })

  it('only imports what it uses', () => {
    const code = composeSnippet(SNIPPETS.pie, 'vue', true).code
    expect(code).toContain("import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'")
    expect(code).not.toContain("from 'd3'")
    expect(code).not.toMatch(/^import .*\bref\b/m)
  })
})
