<p align="center">
  <img src="https://raw.githubusercontent.com/hl037/d3pict.js/master/docs/public/logo.svg" alt="D3Pict" width="420">
</p>

<h1 align="center">Depict your data.</h1>

<p align="center">
  SVG charts you build from objects, on top of <a href="https://d3js.org">d3</a>.<br>
  Interactive, animated, and yours to extend, in plain TypeScript, Vue or React.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/d3pict"><img src="https://img.shields.io/npm/v/d3pict?color=4e79a7" alt="npm"></a>
  <a href="https://github.com/hl037/d3pict.js/actions/workflows/test.yml"><img src="https://github.com/hl037/d3pict.js/actions/workflows/test.yml/badge.svg" alt="tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/d3pict?color=4e79a7" alt="MIT"></a>
</p>

<p align="center">
  <a href="https://d3pict.dev/guide/getting-started"><b>Get started</b></a> ·
  <a href="https://d3pict.dev/examples/showcase">Showcase</a> ·
  <a href="https://d3pict.dev/examples/gallery">Chart types</a> ·
  <a href="https://d3pict.dev/api/">API</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/hl037/d3pict.js/master/docs/public/readme-metrics.png" alt="A time series on four Y axes: bars, a line with a gap, a range and points, with annotations, a title and a legend" width="900">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/hl037/d3pict.js/master/docs/public/readme-polar.png" alt="A stacked rose with a donut at its center" width="380">
</p>

## Why D3Pict

Most chart libraries hand you a finished chart with a few knobs. d3 hands you a blank page. D3Pict sits in between: you assemble a chart from small objects (a series, two axes, a renderer), and everything else, a tooltip, pan and zoom, a legend, a title, is one more object you add. Or don't.

That one idea has some nice consequences:

- **Polar is a change of words.** Turn `position: 'left'` into `'radius'` and `'bottom'` into `'angle'`: the same series, renderer and tooltip now draw a polar chart.
- **Two charts that zoom together** share one `D3PAxisDomain`. That is the whole API for it, and it works between a cartesian chart and a polar one.
- **The legend is not special.** Titles, axis titles and legends are built with the same public pieces you get. Replacing one is writing the same thing, not fighting it.
- **New data just moves.** `series.data = [...series.data, row]`, and the points glide to where they belong. Each point is matched with the one that has the same x, so nothing swaps places.

## Install

```sh
npm install d3pict d3
```

`d3` is a peer dependency. `vue` and `react` are optional: you only need them for `d3pict/vue` and `d3pict/react`. No build step? Import from a CDN, as below.

## A first chart

Save this as `chart.html` and open it. Nothing to install.

```html
<div id="app" style="height: 360px"></div>

<script type="module">
  import { D3PAxis, D3PAxisDomain, D3PChart, D3PLineRenderer, D3PSeries, getGlobalBus } from 'https://esm.sh/d3pict'

  const bus = getGlobalBus() // the channel the objects talk through

  // your data: rows of [x, value]
  const series = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })

  // two axes: each one shows a range of values
  const x = new D3PAxis({ bus, name: 'hour', domain: new D3PAxisDomain({ bus, domain: [0, 24] }) })
  const y = new D3PAxis({ bus, name: 'temperature', domain: new D3PAxisDomain({ bus, domain: [0, 30] }), position: 'left' })

  // a renderer draws a series; its style is a prop
  const line = new D3PLineRenderer({ bus, series, props: { style: { color: '#e15759', curve: 'monotone', strokeWidth: 2.5 } } })

  // a chart shows what you attach to it
  const chart = new D3PChart({ container: document.getElementById('app'), bus })
  for (const object of [x, y, line]) object.addToChart(chart)
</script>
```

That is a chart. [The guide](https://d3pict.dev/guide/getting-started) adds one thing at a time, with the lines that change at each step, and every example on the site has an **Open in CodePen** button.

## Then add what you need

Everything below is one more object attached to the chart, or one prop on an object.

| You want | You add |
|---|---|
| A crosshair and a tooltip | `new D3PCursorIndicator({ bus })`, `new D3PTooltip({ bus })` |
| Pan and zoom | a `D3PToolbox` with a `D3PPanTool` and a `D3PWheelZoomTool` |
| A title, axis titles, a legend | `D3PTitle`, `D3PAxisTitle`, `D3PLegendPanel` |
| Several lines | one more `D3PSeries` and one more renderer |
| Bars, areas, candlesticks, a pie... | another renderer: `D3PBarRenderer`, `D3PAreaRenderer`, `D3PCandlestickRenderer`, `D3PPieRenderer` |
| A polar chart | `position: 'angle'` and `position: 'radius'` on the axes |
| Axes that fit the data | a `D3PAutoDomain` linked to the series |
| New data | `series.data = [...series.data, [28, 15]]`, and the chart animates |
| Charts that move together | give their axes the same `D3PAxisDomain` |
| A file | `chart.downloadSVG('chart.svg')`, `chart.downloadPNG('chart.png')` |

## Vue and React

In a component, `useD3PContext()` makes the objects with the bus of the app and destroys them when the component goes away. `ctx.newSeries({ ... })` does what `new D3PSeries({ bus, ... })` does, for every object.

```vue
<script setup lang="ts">
import { D3PVChart, useD3PContext } from 'd3pict/vue'

const ctx = useD3PContext()
const series = ctx.newSeries({ name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24]] })
const x = ctx.newAxis({ name: 'hour', domain: ctx.newAxisDomain({ domain: [0, 16] }) })
const y = ctx.newAxis({ name: 'temperature', domain: ctx.newAxisDomain({ domain: [0, 30] }), position: 'left' })
const objects = [x, y, ctx.newLineRenderer({ series })]
</script>

<template>
  <div style="height: 360px"><D3PVChart :objects="objects" /></div>
</template>
```

```ts
import { createApp } from 'vue'
import { D3PVPlugin } from 'd3pict/vue'

createApp(App).use(D3PVPlugin) // the app gets a bus of its own
```

```tsx
import { useEffect, useState } from 'react'
import type { D3PChartObject, D3PContext } from 'd3pict'
import { D3PRChart, useD3PContext } from 'd3pict/react'

function build(ctx: D3PContext): D3PChartObject[] {
  const series = ctx.newSeries({ name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24]] })
  const x = ctx.newAxis({ name: 'hour', domain: ctx.newAxisDomain({ domain: [0, 16] }) })
  const y = ctx.newAxis({ name: 'temperature', domain: ctx.newAxisDomain({ domain: [0, 30] }), position: 'left' })
  return [x, y, ctx.newLineRenderer({ series })]
}

export function Chart() {
  const ctx = useD3PContext()
  const [objects, setObjects] = useState<D3PChartObject[]>()
  useEffect(() => setObjects(build(ctx)), [ctx]) // make the objects in an effect, not while rendering
  return objects && <div style={{ height: 360 }}><D3PRChart objects={objects} /></div>
}
```

The components `D3PVTooltip` and `D3PRTooltip` (and the legend, slot and anchor ones) put your own markup in the tooltip, the legend or anywhere on the chart. See [Vue and React](https://d3pict.dev/guide/frameworks).

## Chart types

Lines (curves, steps, gaps), areas (stacked, 100 %, streamgraph, ranges), bars (grouped, stacked, horizontal, lollipops, waterfalls, histograms), scatter and bubbles, candlesticks, box plots, dumbbells, heatmaps, slope charts, annotations, pies, donuts and semi-donuts, polar areas, radial bars, radars, gauges and funnels. Each has a page with its code in [the examples](https://d3pict.dev/examples/gallery), and [the showcase](https://d3pict.dev/examples/showcase) puts most of them side by side.

## Documentation

- [**Guide**](https://d3pict.dev/guide/getting-started): one chart, built in eleven steps, with what changes at each step, for Core, Vue and React.
- [**Concepts**](https://d3pict.dev/guide/concepts): the mental model, notion by notion.
- [**Advanced**](https://d3pict.dev/guide/advanced): the bus, the services, the render loop, projections, the animation, writing your own components.
- [**API reference**](https://d3pict.dev/api/): generated from the source and its comments.
- [**Examples**](https://d3pict.dev/examples/lines): live, with the code to copy.

Working on D3Pict itself:

```sh
pnpm install
pnpm test           # the tests
pnpm typecheck
pnpm build          # the library, in dist/
pnpm docs:dev       # the documentation site, with the API reference generated first
```

## License

[MIT](LICENSE)
