# Advanced

What happens under the objects. You do not need it to draw charts; you need it to write objects of your own, to test, or to understand a surprise.

## Events and the bus

An event is a unique `Symbol` that carries the type of its payload (`D3PEvent<P>`). Two objects can only talk if they hold the same symbol: there are no event names as strings. Every object has a table of its own events, `object.e`: `axis.e.scaleChanged`, `chart.e.resized`, `series.e.dataChanged`.

```ts
const off = bus.on(series.e.dataChanged, () => console.log('new data'))
off() // stop listening
```

The bus (`D3PBus`) **never delivers synchronously**:

- delivery happens in a later microtask, in the order of emission (first in, first out);
- the list of subscribers is read at delivery time, so a subscriber may subscribe or unsubscribe;
- an error in a subscriber is logged and does not stop the others;
- `emit` returns a promise; `bus.idle()` and `d3pSettle(bus)` wait until nothing is in flight, which is what tests need.

Per-chart events (`mousemove`, `tooltipShow`...) are addressed with `chart.event('mousemove')`, and carry the types of `D3PChartEventMap`.

## Services

Each chart holds a registry of services: `chart.get(KEY)`, `chart.provide(KEY, service)`, `chart.services.watch(KEY, callback)`. A key is a typed symbol (`d3pServiceKey<T>()`), so anyone can add one. The axis manager, the renderer manager, the coordinates, the interaction area, the probe and the layout are services of the chart.

## Attachable objects

An object that attaches to charts extends `D3PAttachable<D>`, where `D` is what it keeps for each chart. It implements `createData(chart)` (build the per-chart state), `attached(chart, data, subs)` (subscribe, create DOM; subscriptions added to `subs` are released on detach), and `detached(chart, data)` (clean up). It is detached when its chart is destroyed. `render(chart)` is called when it asks for a redraw with `tagDirty(chart)`.

Props are made with `createProps(defaults, { afterSet })`: callable, deeply merged, with a hook to redraw.

## Drawing in batches

`tagDirty` does not draw: it queues `(chart, object)`. The render manager of the bus deduplicates the queue and runs it once per animation frame (`requestAnimationFrame`, or a timeout without a browser). A request with a transition wins over a request without one in the same frame.

## Animations

A renderer draws with a transition (200 ms) when its data, its props or its series change, and without one when the scale changes (zoom, pan) or the chart is resized.

- **A line** keeps what it shows on screen: for each point, its position in pixels and its key, the value on the x axis it was placed from (a number, or the time of a date; for categories, the position). A new drawing is an interpolation from those positions to the new ones, so a transition that is interrupted starts again from what is visible. The first time, the line grows from the baseline, the bottom of the axis. Hiding a series is the same interpolation the other way.
- **Two lists of points of different lengths** are made as long as each other before they are interpolated, by merging the two lists along their **keys** with a cursor in each. Points with the same key are paired, whatever their pixels: a point that has not changed is paired with itself, even when the scale moved. A point without a partner is paired with the nearest point of the other list (the last one taken or the next one, whichever has the closer key). A point that appears is born on its neighbor and one that goes dies on it, so nothing jumps. The helper is `d3pInterpolateSeries(from, to)`, where `from` and `to` are `{ keys, points }`; it returns a function of `t` between 0 and 1. `from` can be a number, the baseline.
- **Bars** are paired by the x value of their data point (not by their index), so removing the first row does not make every bar take the shape of its neighbor. They enter at the base with a height of 0 and grow, and leave by going back to the base. Their position, size and color are all interpolated.
- **When requests meet.** Redraws are gathered by frame; if one of them comes from a change of the data, the props or the series, the redraw is animated, even if the scale changes in the same frame (an auto domain fitting new data). A scale change alone (zoom, pan) is drawn at once.

## Projections

Three words say how a value becomes a position, and back: `projectTo` goes toward the pixels, `projectFrom` comes back from them.

- `axis.projectTo(chart, value)`: the range position of a value; `axis.projectFrom(point)`: the value under a point of the plot (a `D3PViewportPoint`).
- `system.projectTo(chart, a, b)`: the point of a pair of range units; `system.projectFrom(point)`: the range units under a point, `undefined` outside of the system unless `{ strict: false }`.
- `renderer.projectTo(chart, x, y)` and `renderer.projectFrom(point)`: the whole chain for a data point.

### The pointer event and its cache

The interaction area emits a `D3PPointerEvent` for each mouse event (`D3PWheelEvent`, `D3PDragEvent` for wheel and drag). It carries the pixel (`event.point`) and is a **projection cache**: nothing is computed when it is emitted, and what the tooltip, the cursor, the markers or a tool ask for is computed once.

```ts
bus.on(chart.event('mousemove'), (event) => {
  const value = xAxis.projectFrom(event.point, undefined, event) // the cache is the last argument
  const again = xAxis.projectFrom(event.point, undefined, event) // not computed twice
})
```

Every `projectTo` and `projectFrom` takes an optional `D3PProjectionCache`; the cache is keyed by projector, chart and arguments, so one event serves every chart it is given to. An event is valid until the next redraw: it reads the live state of the chart.

### A pointer that does not move

What is under a still pointer changes when the chart does: a zoom, a resize, a series that gets other data or is hidden. The area then emits `mousemove` again, at the same pixel, with an event of its own (so nothing is kept from the old scale), at most once per frame. The cursor, the markers and the tooltip follow without the pointer moving. A listener that counts `mousemove` events therefore also sees these.

### Snapshots

A gesture that compares with where it started takes a snapshot instead of keeping the event: `event.snapshot()` returns a `D3PViewSnapshot`, the axes and systems of the chart as they are at that moment (`snapshot.getAxis(axis)` has the frozen `domain`, `scale` and `system`, with the same projections). The pan tool measures every move against the snapshot of its `mousedown`, so it does not drift while it writes the live domain.

## The probe and markers

`d3pProbe(chart)` is the service that tells what is under a pointer event: `probe.projectFrom(event, axis)` is the value of an axis (following joins, and events of other charts), `probe.hit(event, renderer)` what a renderer finds there (a `D3PProbeHit`: the point, formatters, color, position, the cell of a bar), both computed once per event. The tooltip is built from the hits.

A marker (`D3PMarker`) shows a hit: `show(chart, hit, event)`, `hide(chart)`, `remove(chart)`. The probe shows and hides the markers of the renderers as the pointer moves, with or without a tooltip.

```ts
renderer.marker = { show(chart, hit, event) { /* draw */ }, hide(chart) {}, remove(chart) {} } // your own
new D3PLineRenderer({ bus, series, marker: new D3PDotMarker(renderer, { radius: 6 }) })
```

## Axis renderers

An axis keeps the domain and the scale; an **axis renderer** decides how it looks. Each position has a default: `D3PCartesianAxisRenderer` (sides), `D3PAngleAxisRenderer` (ring and ticks), `D3PRadiusAxisRenderer` (a spoke at a fixed angle). `D3PCursorRadiusAxisRenderer` is a radius axis whose spoke turns to follow the pointer; `D3PRadarAngleAxisRenderer` draws the polygon of a radar.

A renderer declares the positions and the kinds of system it supports, and the axis throws an explicit error when it does not fit (`axis "r" (position "radius") is not supported by the axis renderer D3PCartesianAxisRenderer; it supports: bottom, top, left, right`). Write your own by extending `D3PAxisRenderer`.

## Your own objects

Titles and legends are the model: a slot for the room (see [layout](/guide/layout)), props for the settings, public services for the data. The standard components use nothing else.
