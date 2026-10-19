/**
 * Assembles the code shown in the documentation. The examples are written once, with
 * `#region` tags in the code that matters: the scenario (the objects of the chart), and what each
 * framework does with them. This module puts the regions back together into one piece of code
 * per framework, that can be copied as it is: the imports are worked out from what the code
 * uses, the series data comes with it or not, and the plumbing the examples need to run in this
 * repository (the destructuring of a scenario, the cleanup) is left out.
 *
 * Node only: it reads the files of `examples/`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type SnippetFramework = 'core' | 'vue' | 'react'

export interface SnippetSource {
  /** File of the scenario, relative to `examples/`, and the region holding the code of the chart. */
  scenario: string
  region?: string
  /** Constants the region is parameterized by, in the scenes that several chart types share (`'offset: D3PStackOffset'` gives the constant a type). */
  params?: Record<string, unknown>
  /**
   * What each framework does with the objects: files with the regions `mount` (core), `template`
   * and `script` (Vue), `view` (React). Without it, the standard way: a chart with its tooltip
   * and legend, for the scenarios that define `objects` (and `margin`, `tooltip`, `legend`).
   */
  glue?: Record<SnippetFramework, string>
}

export interface Snippet {
  lang: 'ts' | 'vue' | 'tsx'
  code: string
}

/** The `examples/` folder: tools run from the root of the repository. */
const ROOT = join(process.cwd(), 'examples')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')

/** The lines between `#region name` and `#endregion name` (`//` or `<!-- -->` comments), without their common indentation. */
export function region(source: string, name: string): string | undefined {
  const lines = source.split('\n')
  const start = lines.findIndex((l) => new RegExp(`(//|<!--)\\s*#region\\s+${name}\\b`).test(l))
  if (start < 0) return undefined
  const end = lines.findIndex((l, i) => i > start && new RegExp(`(//|<!--)\\s*#endregion\\s+${name}\\b`).test(l))
  const body = lines.slice(start + 1, end < 0 ? undefined : end)
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length))
  return body
    .map((l) => l.slice(indent))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')
}

/** `const name = value`; a key `name: Type` makes it `const name = value as Type` (a union stays a union). */
function constant(key: string, value: unknown): string {
  const [name, type] = key.split(/:\s*/)
  return `const ${name} = ${literal(value)}${type ? ` as ${type}` : ''}`
}

/** A value as TypeScript source: single quotes, bare keys. */
function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replaceAll("'", "\\'")}'`
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? `{ ${entries.map(([k, v]) => `${k}: ${literal(v)}`).join(', ')} }` : '{}'
  }
  return String(value)
}

const word = (name: string) => new RegExp(`(?<![\\w$.])${name}(?![\\w$])`)
const has = (code: string, name: string) => word(name).test(code.replaceAll('...', ' '))
const indent = (code: string, by: string) => code.split('\n').map((l) => (l ? by + l : l)).join('\n')

/** Presentation: the example files size their charts with the CSS of this repository, a snippet does it inline. */
function inlineStyles(code: string): string {
  return code
    .replaceAll('class="chart-host"', 'style="height: 420px"')
    .replaceAll('className="chart-host"', 'style={{ height: 420 }}')
    .replaceAll('class="chart-row"', 'style="display: flex; gap: 8px; height: 420px"')
    .replaceAll('className="chart-row"', "style={{ display: 'flex', gap: 8, height: 420 }}")
    .replaceAll('class="chart-column"', 'style="display: flex; flex-direction: column; gap: 8px; height: 420px"')
    .replaceAll('className="chart-column"', "style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 420 }}")
}

// ---------------------------------------------------------------------------
// Series data
// ---------------------------------------------------------------------------

const DATA_HELPERS = ['rng', 'walk', 'timeSeries', 'indexed'] as const

interface Needs {
  /** Helper code (functions) the chart calls, in the order to write them. */
  code: string[]
  /** Names of what `code` defines, to import from your own data module when `withData` is off. */
  names: string[]
}

/** The data helpers (shared and scenario-local) a piece of code calls. */
function dataNeeds(code: string, scenarioFile: string): Needs {
  const shared = read('shared/data.ts')
  const local = region(scenarioFile, 'data')
  const defs = new Map<string, string>()
  for (const n of DATA_HELPERS) defs.set(n, region(shared, n)!)
  if (local) for (const m of local.matchAll(/^(?:export )?function (\w+)/gm)) defs.set(m[1], local)
  const used: string[] = []
  const visit = (text: string) => {
    for (const [name, def] of defs) {
      if (used.includes(name) || !has(text, name)) continue
      used.unshift(name) // a helper goes before what calls it
      visit(def.replace(new RegExp(`function ${name}\\b`), ''))
    }
  }
  visit(code)
  const codes: string[] = []
  for (const name of used) {
    const def = defs.get(name)!
    if (!codes.includes(def)) codes.push(def)
  }
  // what the chart itself calls (not the helpers of the helpers) is what a data module has to provide
  return { code: codes.map((c) => c.replace(/^export /gm, '')), names: used.filter((n) => has(code, n)) }
}

interface DataParts {
  /** An import of your own data module (the generators are not written out). */
  imports: string
  /** The generators themselves (they are written out). */
  code: string
}

function dataParts(needs: Needs, withData: boolean): DataParts {
  if (!needs.names.length) return { imports: '', code: '' }
  if (withData) return { imports: '', code: needs.code.join('\n\n') }
  return { imports: `// your series data: replace these generators with your own values\nimport { ${[...needs.names].sort().join(', ')} } from './data'`, code: '' }
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const TYPES = new Set(['D3PBus', 'D3PStackOffset', 'D3PStackOrder'])

function importLine(names: string[], from: string): string {
  const items = [...new Set(names)].sort((a, b) => a.localeCompare(b)).map((n) => (TYPES.has(n) ? `type ${n}` : n))
  const one = `import { ${items.join(', ')} } from '${from}'`
  if (one.length <= 110) return one
  const lines: string[] = []
  let line = ' '
  for (const item of items) {
    if ((line + ' ' + item + ',').length > 110) (lines.push(line), (line = ' '))
    line += ' ' + item + ','
  }
  lines.push(line)
  return `import {\n${lines.join('\n')}\n} from '${from}'`
}

/** Import lines for what `code` uses: the library, its adapters, d3, and the framework's own hooks. */
function importsFor(source: string, fw: SnippetFramework): string {
  // what the code uses, not what its comments say
  const code = source.replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1').replaceAll('...', ' ') // a spread is not a property access
  const lib: string[] = []
  const vue: string[] = []
  const react: string[] = []
  for (const m of code.matchAll(/(?<![\w$.])(D3P\w+|d3p\w+|getGlobalBus|useD3PBus)(?![\w$])/g)) {
    const n = m[1]
    if (n === 'useD3PBus') (fw === 'vue' ? vue : react).push(n)
    else if (/^D3PV[A-Z]/.test(n) && fw === 'vue') vue.push(n)
    else if (/^D3PR[A-Z]/.test(n) && fw === 'react') react.push(n)
    else lib.push(n)
  }
  const out: string[] = []
  if (/(?<![\w$.])d3\./.test(code)) out.push("import * as d3 from 'd3'")
  if (fw === 'vue') {
    const hooks = ['onBeforeUnmount', 'reactive', 'ref', 'computed'].filter((h) => new RegExp(`(?<![\\w$.])${h}\\s*[<(]`).test(code))
    if (hooks.length) out.push(importLine(hooks, 'vue'))
  }
  if (fw === 'react') {
    const hooks = ['useState', 'useEffect', 'useMemo', 'useRef'].filter((h) => new RegExp(`(?<![\\w$.])${h}(?![\\w$])`).test(code))
    if (hooks.length) out.push(importLine(hooks, 'react'))
  }
  if (lib.length) out.push(importLine(lib, 'd3pict'))
  if (vue.length) out.push(importLine(vue, 'd3pict/vue'))
  if (react.length) out.push(importLine(react, 'd3pict/react'))
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// What to release
// ---------------------------------------------------------------------------

/** Expressions listing everything the chart code created, to destroy it when the page or component goes away. */
function createdList(chart: string): string[] {
  const out: string[] = []
  // top-level statements: `const name = ...` up to the next line that starts a new one
  const statements = chart.split(/\n(?=const |let |for |[a-z]\w*[.(])/)
  for (const statement of statements) {
    const m = statement.match(/^const (\w+)(?::[^=]+)? = ([\s\S]*)$/)
    if (!m || !/new D3P/.test(m[2])) continue
    if (/^new D3P\w+\(/.test(m[2])) out.push(m[1])
    else if (m[2].startsWith('{')) out.push(`...Object.values(${m[1]}).flat()`)
    else out.push(`...${m[1]}`)
  }
  return [...new Set(out)]
}

const destroyAll = (list: string[]) => `[${list.join(', ')}].forEach((o) => o.destroy())`

// ---------------------------------------------------------------------------
// The three frameworks
// ---------------------------------------------------------------------------

interface Glue {
  mount?: string
  script?: string
  template?: string
  view?: string
  /** The names the React view takes from the scene. */
  names?: string
}

/** Pieces of the framework files: regions of the example's own files. */
function glueFromFiles(files: Record<SnippetFramework, string>): Record<SnippetFramework, Glue> {
  const react = read(files.react)
  return {
    core: { mount: region(read(files.core), 'mount') },
    vue: { script: region(read(files.vue), 'script'), template: region(read(files.vue), 'template') },
    react: { view: region(react, 'view'), names: react.match(/function View\(\{ scene: \{ ([^}]*) \} \}/)?.[1].trim() },
  }
}

/** The standard glue, for the scenarios that define `objects`, and `margin`, `tooltip`, `legend` when they need them. */
function standardGlue(chart: string): Record<SnippetFramework, Glue> {
  const defined = (name: string) => new RegExp(`^const ${name}\\b`, 'm').test(chart)
  const margin = defined('margin')
  const tooltip = defined('tooltip')
  const legend = defined('legend')
  const actions = defined('actions')
  const names = ['objects', margin && 'margin', tooltip && 'tooltip', legend && 'legend', actions && 'actions'].filter(Boolean).join(', ')
  // what is driven by the pointer needs an interaction area; a chart that only draws does not
  const pointer = /D3P(CursorIndicator|Tooltip|Toolbox|PanTool|WheelZoomTool|WheelPanTool|ClickZoomTool|ZoomSelectionTool|ResetTool|CursorRadiusAxisRenderer)/.test(chart)
  return {
    core: {
      mount: [
        actions && "const toolbar = document.createElement('div')\ncontainer.before(toolbar)\n// a button for each way to change the data\nfor (const [name, run] of Object.entries(actions)) toolbar.append(Object.assign(document.createElement('button'), { textContent: name, onclick: run }))\n",
        `const chart = new D3PChart({ container, bus${margin ? ', margin' : ''} })`,
        pointer && 'const stopArea = d3pAutoInteractionArea(chart) // before the objects: the cursor, the tooltip and the tools ask for an interaction area',
        'objects.forEach((o) => o.addToChart(chart))',
        tooltip && 'const stopTooltip = d3pDomTooltip(tooltip)',
        legend && 'const stopLegend = d3pDomLegend(legend)',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    vue: {
      template: [
        actions && '<div class="toolbar">',
        actions && '  <button v-for="(run, name) in actions" :key="name" @click="run()">{{ name }}</button>',
        actions && '</div>',
        '<div class="chart-host">',
        `  <D3PVChart :objects="objects"${margin ? ' :margin="margin"' : ''} />`,
        '</div>',
        legend && '<D3PVLegend :legend="legend" />',
        tooltip && '<D3PVTooltip :tooltip="tooltip" />',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    react: {
      names,
      view: [
        'return (',
        '  <>',
        actions && '    <div className="toolbar">',
        actions && '      {Object.entries(actions).map(([name, run]) => (',
        actions && '        <button key={name} onClick={run}>',
        actions && '          {name}',
        actions && '        </button>',
        actions && '      ))}',
        actions && '    </div>',
        '    <div className="chart-host">',
        `      <D3PRChart objects={objects}${margin ? ' margin={margin}' : ''} />`,
        '    </div>',
        legend && '    <D3PRLegend legend={legend} />',
        tooltip && '    <D3PRTooltip tooltip={tooltip} />',
        '  </>',
        ')',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  } as Record<SnippetFramework, Glue>
}

const stack = (...parts: string[]) => parts.filter(Boolean).join('\n')

function core(chart: string, glue: Glue, data: DataParts): string {
  const mount = glue.mount!
  const several = /\brow\b/.test(mount)
  const body = [
    data.code,
    'const bus = getGlobalBus()',
    several
      ? "const row = document.getElementById('app')! // a flex container with a size: the charts share it"
      : "const container = document.getElementById('app')! // any element with a size: the chart fills it",
    chart,
    mount,
  ]
    .filter(Boolean)
    .join('\n\n')
  return stack(importsFor(body, 'core'), data.imports) + '\n\n' + body + '\n'
}

function vue(chart: string, glue: Glue, data: DataParts): string {
  const script = glue.script
  const template = glue.template!
  const list = createdList(chart)
  const body = [
    data.code,
    'const bus = useD3PBus() // the app installs the plugin: app.use(D3PVPlugin)',
    chart,
    script ?? '',
    `// release everything the chart created when the component goes away\nonBeforeUnmount(() => ${destroyAll(list)})`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const imports = importsFor(body + '\n' + template, 'vue')
  return `<script setup lang="ts">\n${stack(imports, data.imports)}\n\n${body}\n</script>\n\n<template>\n${indent(template, '  ')}\n</template>\n`
}

function react(chart: string, glue: Glue, data: DataParts): string {
  const view = glue.view!
  const names = glue.names!
  const list = createdList(chart)
  const body = [
    data.code,
    `function build(bus: D3PBus) {\n${indent(chart, '  ')}\n\n  return { ${names}, destroy: () => ${destroyAll(list)} }\n}`,
    `export function Example() {
  const bus = useD3PBus()
  const [scene, setScene] = useState<ReturnType<typeof build>>()
  // create the objects once mounted, and destroy them on unmount
  useEffect(() => {
    const created = build(bus)
    setScene(created)
    return () => created.destroy()
  }, [bus])
  return scene && <View scene={scene} />
}`,
    `function View({ scene: { ${names} } }: { scene: ReturnType<typeof build> }) {\n${indent(view, '  ')}\n}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return stack(importsFor(body, 'react'), data.imports) + '\n\n' + body + '\n'
}

/** The code shown for `source` with `framework`; `withData` writes the data generators into it. */
export function composeSnippet(source: SnippetSource, framework: SnippetFramework, withData: boolean): Snippet {
  const scenarioFile = read(source.scenario)
  let chart = region(scenarioFile, source.region ?? 'chart')
  if (chart === undefined) throw new Error(`[snippets] no region "${source.region ?? 'chart'}" in ${source.scenario}`)
  if (source.params) chart = Object.entries(source.params).map(([k, v]) => constant(k, v)).join('\n') + '\n\n' + chart
  // shared constants of the scenario file (`COLORS`, `MONTHS`...), when the chart uses them
  const helpers = region(scenarioFile, 'helpers')
  if (helpers) {
    const defined = [...helpers.matchAll(/^(?:export )?(?:const|function) (\w+)/gm)].map((m) => m[1])
    if (defined.some((n) => has(chart!, n))) chart = helpers + '\n\n' + chart
  }
  const needs = dataNeeds(chart, scenarioFile)
  const data = dataParts(needs, withData)
  const glue = (source.glue ? glueFromFiles(source.glue) : standardGlue(chart))[framework]
  if (framework === 'core') return { lang: 'ts', code: inlineStyles(core(chart, glue, data)) }
  if (framework === 'vue') return { lang: 'vue', code: inlineStyles(vue(chart, glue, data)) }
  return { lang: 'tsx', code: inlineStyles(react(chart, glue, data)) }
}
