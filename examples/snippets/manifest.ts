import type { SnippetSource } from './compose'

/** What the documentation shows for each example: where its chart is built, and the file of each framework. */
function entry(id: string, name: string, extra: Partial<SnippetSource> = {}): SnippetSource {
  return { scenario: `scenarios/${id}.ts`, glue: { core: `core/${id}.ts`, vue: `vue/${name}.vue`, react: `react/${name}.tsx` }, ...extra }
}

/** The steps of the guide: one chart, a little more at each step. */
export const GUIDE_STEPS = 11

export const SNIPPETS: Record<string, SnippetSource> = {
  lines: entry('lines', 'Lines'),
  tools: entry('tools', 'Tools'),
  synced: entry('synced', 'Synced'),
  polar: entry('polar', 'Polar'),
  pie: entry('pie', 'Pie'),
  axes: entry('axes', 'Axes'),
  titles: entry('titles', 'Titles'),
  many: entry('many', 'Many'),
  data: entry('data', 'Data'),
  export: entry('export', 'Export'),
  polarsync: entry('polarsync', 'PolarSync'),
  showcase: entry('showcase', 'Showcase'),
}

/**
 * The chart types of the gallery: the code of one scene (a region of `scenarios/gallery.ts`), with the
 * standard glue. Scenes that several types share are told which one they are.
 */
export const TYPES: Record<string, { region: string; params?: Record<string, unknown> }> = {
  curves: { region: 'curves' },
  'stacked-area': { region: 'stackedArea', params: { 'offset: D3PStackOffset': 'none', 'order: D3PStackOrder': 'none' } },
  'percent-area': { region: 'stackedArea', params: { 'offset: D3PStackOffset': 'expand', 'order: D3PStackOrder': 'none' } },
  streamgraph: { region: 'stackedArea', params: { 'offset: D3PStackOffset': 'wiggle', 'order: D3PStackOrder': 'insideOut' } },
  'stacked-column': { region: 'stackedColumn' },
  'range-area': { region: 'rangeArea' },
  histogram: { region: 'histogram' },
  'horizontal-bar': { region: 'horizontalBar' },
  lollipop: { region: 'lollipop' },
  waterfall: { region: 'waterfall' },
  timeline: { region: 'timeline' },
  candlestick: { region: 'candlestick' },
  boxplot: { region: 'boxplot' },
  dumbbell: { region: 'dumbbell' },
  bubble: { region: 'bubble' },
  heatmap: { region: 'heatmap' },
  slope: { region: 'slope' },
  annotations: { region: 'annotations' },
  radar: { region: 'radar' },
  'polar-area': { region: 'polarArea' },
  'radial-bar': { region: 'radialBar' },
  gauge: { region: 'gauge' },
  'semi-donut': { region: 'semiDonut' },
  funnel: { region: 'funnel' },
}

for (const [id, { region, params }] of Object.entries(TYPES)) SNIPPETS[`type-${id}`] = { scenario: 'scenarios/gallery.ts', region, params }

for (let n = 1; n <= GUIDE_STEPS; n++) SNIPPETS[`guide-${n}`] = { scenario: `guide/step${String(n).padStart(2, '0')}.ts` }
