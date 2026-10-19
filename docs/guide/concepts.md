# Concepts

The ideas of D3Pict, and the words the documentation uses.

## From data to pixels

Everything the library does is a chain from your values to a position on screen:

```text
your values ──▶ domain ──axis──▶ range ──system──▶ pixels
 (a date, 42.5,   (the part of     (units of the    (the plot area
  a category)      the data an      coordinate       of the chart)
                   axis shows)      system)
```

| Space | What it is | Example |
|---|---|---|
| domain | the values of your data along an axis | a date, `42.5`, a category |
| range | the units of a coordinate system | pixels (cartesian), radians and distance (polar) |
| pixel | the plot area of the chart | a point of the SVG |

An **axis** maps a domain to a range with a *scale*. A **coordinate system** maps a range to pixels. A **renderer** reads a series, asks the axes and the system for positions, and draws. Because the renderer only talks to the axes and the system, the same renderer draws in a rectangle or on a disc: change the axes, not the renderer.

## The chart and its objects

A `D3PChart` is an empty SVG in a container. Everything else is an **object** attached to it with `addToChart(chart)` (or listed in the `objects` of a Vue or React chart): axes, renderers, the cursor, the tooltip, tools, titles. An object works for as many charts as it is attached to: the same tool can drive two charts, and one tooltip can span several.

Objects are created with options, and most have `props`: settings you can read and change at any time (`line.props({ style: { color: 'tomato' } })`). The chart redraws by itself.

An object is removed with `removeFromChart(chart)` and freed with `destroy()`. Destroying a chart detaches everything from it.

Every object takes a `bus`: the channel objects talk through. Use the same one everywhere ([Advanced](/guide/advanced) says what goes through it). A chart and the objects attached to it must share one bus.

## Series

A `D3PSeries` is your data: a name, and rows of values. The first column is `x`, the second the main value; a series can have more, named, columns (a `min` and a `max`, an `open`, `high`, `low` and `close`). It accepts numbers, positional rows, objects, columns, any iterable. When its data changes, whatever draws it follows. See [step 3](/guide/series-and-style).

Series can be derived: `D3PStack`, `D3PWaterfall` and `D3PHistogram` take series and produce others, and keep them up to date.

## Domains, axes and scales

A **domain** (`D3PAxisDomain`) is the range of values an axis shows: two numbers, two dates, or a list of categories. It knows nothing else, not even an axis. It can be written, and everything that depends on it follows: zooming is writing a domain.

An **axis** (`D3PAxis`) has a domain, a name, a position (`bottom`, `top`, `left`, `right`, or `angle` and `radius` in polar) and a scale type (`linear`, `time`, `log`, `band`...). It builds its scale from the domain and the size of the chart, draws itself (ticks, labels, grid), and answers two questions: where is this value (`axis.projectTo`), and which value is here (`axis.projectFrom`).

An **auto domain** (`D3PAutoDomain`) sets domains from the data of series, and keeps them up to date. See [step 2](/guide/axes-and-domains).

**Several axes.** A chart takes as many axes as you give it, on both sides, with scales of different kinds. A renderer names the axes it draws against with its `axes` option; without it, it takes the first x axis and the first y axis of the same system. See [step 7](/guide/several-axes).

## Coordinate systems

A **system** gives a meaning to the pixels of the plot. Two exist: *cartesian* (x to the right, y upward: the range is in pixels) and *polar* (an angle and a distance from the center: the range is in radians and pixels). An axis belongs to a system by its position: `bottom`, `top`, `left`, `right` are cartesian; `angle` and `radius` are polar. The system is created with the first axis that needs it; create it yourself to set its options (`D3PPolarSystem`: start angle, direction, sweep, hole, reach).

Several systems can share a chart (a rose with a donut at its center, say): name them, and point axes and renderers at them with the `system` option.

Where a system has no place for a value (outside the disc, in the hole, beyond the angle range), nothing is drawn and the pointer has no value there. See [step 9](/guide/polar).

## Renderers

A **renderer** draws one series: lines, areas, bars, points, candlesticks, a heatmap, a pie... It is told how to look by its `props` (color, curve, width...), and it can say what is under the pointer and how to mark it. Some renderers only make sense in a cartesian system (a candlestick) and say so when given polar axes. See [step 8](/guide/chart-kinds) and the [chart types](/examples/gallery).

A renderer also gives entries to the legend (a pie has one per slice) and a **marker**: the dot, outline or highlight that shows the point under the pointer. The marker belongs to the renderer because only it knows what to highlight; give another, or none.

## The pointer

Three parts take part in the pointer, and each can be used on its own.

- **The interaction area** is a transparent rectangle over the plot: the single source of mouse events (`mousemove`, `mousedown`, `wheel`, `drag`...). The Vue and React charts create it; in plain TypeScript, `d3pAutoInteractionArea(chart)` does.
- **Tools** act on the chart: pan, zoom, selection zoom, reset. A tool does one thing, it writes the domains of the axes it is given. See [step 5](/guide/zoom-and-pan).
- **The cursor, the tooltip and the markers** show what is under the pointer. They ask the *probe* of the chart, which finds for an event the value of each axis and the point each renderer would show. See [step 4](/guide/hover).

## Layout

The room around the plot is given out in **bands**: strips along a side of the chart that an object reserves, and that the plot gives up. A **slot** is a band and an HTML element on it. Titles, axis titles and the standard legend are made of slots; so can be your own components. See [step 6](/guide/layout).

## Several charts

Two axes built on the same domain show the same range, even on two charts: drag on one and the other follows. The tools, the cursor and the tooltip can be attached to several charts at once; they find the axes of each chart by **name**, so give the same names to the axes that mean the same thing.

A **join** says that axes with different names, or in different systems, describe the same quantity: a time on a cartesian x axis and the angle of a polar chart. With it the pointer carries over from one to the other, with a conversion if the units differ.

```ts
// time (0-100) on the cartesian axis is an angle (0-360 degrees) on the polar one
chart.coords.join({ axes: ['time', 'angle'], convert: (value) => (value as number) * 3.6 })

// or only for one tooltip
new D3PTooltip({ bus, joins: [{ axes: ['angle', 'time'], convert: (v, from) => (from === 'time' ? (v as number) * 3.6 : (v as number) / 3.6) }] })
```

Axes with the same name, and axes sharing a domain, are joined without being told. See the [synchronized charts](/examples/synced) and [cartesian and polar, synchronized](/examples/polarsync) examples.

## When things are drawn

Writing is immediate, drawing is not. When you change a domain, a prop or some data, the chart does not redraw at once: the changes of a frame are gathered and drawn together at the next animation frame. Reading right after writing is always right (an axis rebuilds its scale from the domain every time it is read), but the SVG is up to date a moment later. In tests, `await d3pSettle(bus)` waits until everything is drawn.

Drawing is animated when the data changes and not when the user zooms or pans, so that dragging never lags behind the pointer.

## Layers

A chart draws in layers, from the back: `background`, `axis`, `data`, `annotation`, `markers` (dots and outlines under the pointer), `overlay` (the cursor and the tooltip), `interaction`. `frame` is apart: it is in the coordinates of the SVG, not of the plot, and holds what sits around the plot.

## Going further

- [Advanced](/guide/advanced): events, the bus, services, projections, writing your own objects.
- [Chart types reference](/guide/chart-types): how each kind of chart is built.
- [Examples](/examples/showcase): live charts with their code.
