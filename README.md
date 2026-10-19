<p align="center">
  <img src="docs/public/logo.svg" alt="D3Pict" width="420">
</p>

**SVG charts built on [d3](https://d3js.org).** From one line to a polar chart, synchronized charts and your own components. Plain TypeScript, Vue or React.

- **One chart, built from objects.** Axes, series, renderers, tools, a cursor, a tooltip, titles and a legend are objects you attach to a chart. The kind of chart is the renderer: lines, areas, bars, candlesticks, a heatmap, a pie...
- **Interactive.** Cursor, tooltip, legend, pan, zoom, selection. Charts that share a domain follow each other, a polar chart and a cartesian one included.
- **Animated.** Assign the data of a series and everything that draws it moves from what was there to what is there now.
- **Yours to extend.** The titles, the legend and the axes' titles are made of public pieces; so can your components be.
- **Core, Vue or React.** The same objects everywhere; the adapters mount the chart and render HTML content.

## Install

```sh
pnpm add d3pict d3        # or npm install, yarn add
```

`d3` (7.9 or later) is a peer dependency. `vue` (3.5 or later) and `react` (18 or later) are optional: you need one only for `d3pict/vue` or `d3pict/react`.

## A chart

This is the whole of a chart: two series on polar axes, with a cursor, a tooltip, pan and zoom, titles, a legend, and buttons that change the data. Everything is created with a `bus` (the events of the library go through it) and attached to a chart at the end.

```html
<div id="app" style="height: 420px"></div>
```

```ts
import {
  D3PAutoDomain, d3pAutoInteractionArea, D3PAxis, D3PAxisDomain, D3PAxisTitle, D3PChart, D3PCursorIndicator,
  d3pDomTooltip, D3PLegendPanel, D3PLineRenderer, D3PPanTool, D3PPoint, D3PResetTool, D3PSeries, D3PTitle,
  D3PToolbox, D3PTooltip, D3PWheelZoomTool, getGlobalBus,
} from 'd3pict'

const bus = getGlobalBus()
const container = document.getElementById('app')! // any element with a size: the chart fills it

// series: rows of [x, value]
const temperature = new D3PSeries({ bus, name: 'temperature', data: [[0, 12], [4, 9], [8, 14], [12, 21], [16, 24], [20, 17], [24, 13]] })
const feelsLike = new D3PSeries({ bus, name: 'feels like', data: [[0, 10], [4, 6], [8, 12], [12, 22], [16, 25], [20, 15], [24, 11]] })

// domains: the values an axis shows. An auto domain fits them to the data, now and when it changes
const hours = new D3PAxisDomain({ bus, domain: [0, 24] })
const degrees = new D3PAxisDomain({ bus, domain: [0, 30] })
const auto = new D3PAutoDomain({ bus })
auto.linkSeries(temperature, [hours, degrees])
auto.linkSeries(feelsLike, [hours, degrees])

// axes read a domain; their position says where they are drawn: the hour is an angle, the temperature a distance from the center
const x = new D3PAxis({ bus, name: 'hour', domain: hours, position: 'angle', props: { tickCount: 6, tickFormat: (v) => `${Math.round(v)} h`, grid: { enabled: true } } })
const y = new D3PAxis({ bus, name: 'temperature', domain: degrees, position: 'radius', props: { tickFormat: (v) => `${Math.round(v * 10) / 10} °C`, grid: { enabled: true } } })

// one renderer per series; its style is a prop
const line = new D3PLineRenderer({ bus, series: temperature, props: { style: { color: '#e15759', curve: 'monotone', strokeWidth: 2.5 } } })
const feelsLine = new D3PLineRenderer({ bus, series: feelsLike, props: { style: { color: '#4e79a7', curve: 'monotone' } } })

// what the pointer shows: a crosshair and a tooltip
const cursor = new D3PCursorIndicator({ bus })
const tooltip = new D3PTooltip({ bus })

// tools act on the domains: drag to pan, wheel to zoom
const tools = new D3PToolbox({ bus })
tools.addTool(new D3PPanTool({ bus }))
tools.addTool(new D3PWheelZoomTool({ bus }))
tools.addTool(new D3PResetTool({ bus }))
for (const name of ['pan', 'wheel-zoom', 'reset']) tools.setToolActive(name)

// titles and a legend take their room from the plot
const title = new D3PTitle({ bus, props: { text: 'Temperature', subtitle: 'on 12 June' } })
const xTitle = new D3PAxisTitle({ bus, axis: x, props: { text: 'hour of the day' } })
const yTitle = new D3PAxisTitle({ bus, axis: y, props: { text: 'temperature' } })
const legendPanel = new D3PLegendPanel({ bus, placement: 'bottom' })

// changing the data is assigning the series: the lines move from what was there to what is there now, and the domains fit it
const next = (series: D3PSeries): D3PPoint => {
  const last = series.data[series.data.length - 1]
  return [+last[0] + 4, Math.round(Math.min(30, Math.max(0, last[1] + (Math.random() - 0.5) * 10)))]
}
const both = [temperature, feelsLike]
const actions: Record<string, () => void> = {
  'add a point': () => both.forEach((series) => (series.data = [...series.data, next(series)])),
  'remove the last': () => both.forEach((series) => series.data.length > 2 && (series.data = series.data.slice(0, -1))),
  'remove the first': () => both.forEach((series) => series.data.length > 2 && (series.data = series.data.slice(1))),
}
const toolbar = document.createElement('div')
container.before(toolbar)
for (const [name, run] of Object.entries(actions)) toolbar.append(Object.assign(document.createElement('button'), { textContent: name, onclick: run }))

// the chart: attach everything to it
const chart = new D3PChart({ container, bus })
const stopArea = d3pAutoInteractionArea(chart) // before the objects: the cursor, the tooltip and the tools ask for an interaction area
const objects = [x, y, line, feelsLine, cursor, tooltip, tools, title, xTitle, yTitle, legendPanel]
objects.forEach((o) => o.addToChart(chart))
const stopTooltip = d3pDomTooltip(tooltip) // the tooltip as HTML, positioned by the library
```

When the page goes away, release what you created: `stopTooltip()`, `stopArea()`, `chart.destroy()`, then `destroy()` on each object.

### What each part does

- **Series** hold the rows. A row is `[x, value, ...more columns]`; a series also takes numbers, objects (`fields`), columns, any iterable. Assign `series.data` to change it.
- **Domains** are the values an axis covers. They are objects of their own, so axes of several charts can share one: the charts then zoom and pan together. `D3PAutoDomain` fits domains to series.
- **Axes** have a name, a domain, a position (`bottom`, `top`, `left`, `right`, or `angle` and `radius`), a scale type (`linear`, `log`, `time`, `band`...) and props (ticks, format, grid). Several axes can share a side (`offset`).
- **Renderers** draw a series against axes: `D3PLineRenderer`, `D3PAreaRenderer`, `D3PBarRenderer`, `D3PScatterRenderer`, `D3PPieRenderer`, `D3PCandlestickRenderer`... Their `props` are live: change one and the chart draws again.
- **Cursor, tooltip and legend** read what is under the pointer through the axes. Pointer values are *not* ticks: round them in `tickFormat`.
- **Tools** (`D3PPanTool`, `D3PWheelZoomTool`, `D3PZoomSelectionTool`, `D3PResetTool`...) change the domains, in a toolbox where some can exclude others.
- **Titles and legends** take their room from the plot, through the layout of the chart (`chart.layout`). They are made of the same public pieces (`D3PSlot`, bands) your own components would use, and none is there unless you attach it.
- **Cartesian or polar** is a matter of axis positions: replace `position: 'angle'` and `'radius'` by nothing (the default `bottom`) and `'left'`, and the same chart is cartesian. Several systems can live in one chart, or in two charts that share a domain.

## Vue

```ts
import { createApp } from 'vue'
import { D3PVPlugin } from 'd3pict/vue'

createApp(App).use(D3PVPlugin) // the app gets a bus of its own
```

```vue
<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVTooltip, useD3PBus } from 'd3pict/vue'

const bus = useD3PBus()
// ... create the series, axes, renderers and tooltip with `bus`, as above, then list them in `objects`
onBeforeUnmount(() => objects.forEach((o) => o.destroy()))
</script>

<template>
  <div style="height: 420px">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVTooltip :tooltip="tooltip" />
</template>
```

## React

```tsx
import { useEffect, useState } from 'react'
import type { D3PChartObject, D3PTooltip } from 'd3pict'
import { D3PRChart, D3PRTooltip, useD3PBus } from 'd3pict/react'

function Chart() {
  const bus = useD3PBus()
  const [scene, setScene] = useState<{ objects: D3PChartObject[]; tooltip: D3PTooltip; destroy(): void }>()
  useEffect(() => {
    const created = build(bus) // create the objects, as above
    setScene(created)
    return () => created.destroy()
  }, [bus])
  if (!scene) return null
  return (
    <>
      <div style={{ height: 420 }}>
        <D3PRChart objects={scene.objects} />
      </div>
      <D3PRTooltip tooltip={scene.tooltip} />
    </>
  )
}
```

The components put your own markup in the tooltip, the legend, a slot or an anchor: `D3PVTooltip` and `D3PRTooltip` take a default slot and a children function. See [Vue and React](docs/guide/frameworks.md).

## Chart types

Lines (curves, steps, gaps), areas (stacked, 100 %, streamgraph, ranges), bars (grouped, stacked, horizontal, lollipops, waterfalls, histograms), scatter and bubbles, candlesticks, box plots, dumbbells, heatmaps, slope charts, annotations, pies, donuts and semi-donuts, polar areas, radial bars, radars, gauges and funnels. Each has a page with its code in [the examples](docs/examples/gallery.md), and [the showcase](docs/examples/showcase.md) combines most of them.

## Documentation

- [**Guide**](docs/guide/getting-started.md): one chart, built in ten steps, with what changes at each step, for Core, Vue and React.
- [**Concepts**](docs/guide/concepts.md): the mental model, notion by notion.
- [**Advanced**](docs/guide/advanced.md): the bus, the services, the render loop, projections, the animation, writing your own components.
- **API reference**: generated from the source and its comments (`pnpm docs:api`, or in the site's *Reference* menu).
- [**Examples**](docs/examples/lines.md): live, with the code to copy.

```sh
pnpm install
pnpm docs:dev       # the documentation site, with the API reference generated first
pnpm examples       # the examples app
pnpm test           # the tests
pnpm typecheck
pnpm build          # the library, in dist/
```

## License

MIT
