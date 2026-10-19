# Getting started

D3Pict draws charts as SVG, on top of [d3](https://d3js.org). Use it from plain TypeScript, Vue or React: the chart is the same, only the last lines change.

This guide builds **one chart**, from a single line to a polar one whose data you change, in ten steps. Each step adds something and shows what changed. [Concepts](/guide/concepts) gives the whole picture.

## Install

```sh
pnpm add d3pict d3
```

`d3` is a peer dependency. Vue and React are optional: only `d3pict/vue` and `d3pict/react` use them.

## Step 1: one line

The tabs give the code for plain TypeScript, Vue and React. The chart is the same.

<ExampleLive id="guide-1" :height="340" />

- **Series.** `D3PSeries` holds your data: a name and a list of `[x, value]` points.
- **Axes.** `D3PAxis` draws an axis. Its `D3PAxisDomain` is the range of values the axis shows: `[0, 24]` on the x axis, `[0, 30]` on the y axis. `position: 'left'` puts the y axis on the left; an axis is at the `bottom` by default. The `name` of an axis is how other objects refer to it.
- **Renderer.** `D3PLineRenderer` draws a series as a line. It finds its axes by itself: the first x axis and the first y axis of the chart.
- **Bus.** Every object takes a `bus`: the channel the objects talk through. Pass the same one to all of them. Vue and React give you one (see [Vue and React](/guide/frameworks)).
- **Chart.** `D3PChart` is an empty SVG in a container. Nothing is drawn until objects are attached to it: `addToChart(chart)` in plain TypeScript, the `objects` list in Vue and React.

Everything you attach is an **object**: axes and renderers now, and later the cursor, the tooltip, the tools and the titles. One object can be attached to several charts, which is how charts are [synchronized](/guide/concepts#several-charts).

::: tip The container needs a size
A chart fills its container and follows it when it is resized. Give the container a height in CSS (`height: 400px`); without one, the chart has nothing to fill.
:::
