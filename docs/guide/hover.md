# Step 4: cursor, tooltip and legend

Three types of object react to the pointer: a cursor that gives the value under it on each axis, a tooltip that lists the values of the series, and a legend that shows and hides series.

<ExampleLive id="guide-4" :height="340" />

What changed:

- **`D3PCursorIndicator`** draws a crosshair that follows the pointer, with the value of each axis on the axis.
- **`D3PTooltip`** lists the value of each series at the pointer.
- **`D3PLegendBundle`** lists the series; a click on an entry hides its line.
- **Core only: an interaction area.** Pointer events come from an interaction area, a transparent rectangle over the plot. In plain TypeScript, `d3pAutoInteractionArea(chart)` creates it when something asks for it, and must be called **before** the objects are attached. The Vue and React charts do it for you.
- **The HTML is yours.** The tooltip and the legend compute what to show and give an element to put it in. `d3pDomTooltip` and `d3pDomLegend` fill that element with a simple default; the Vue and React adapters have components for it, which take your own content too (see [Vue and React](/guide/frameworks)).

## The labels of the cursor

The cursor writes the value under the pointer with the `tickFormat` of the axis. That value is not a tick: it has many decimals, so a format like `` (v) => `${Math.round(v)} %` `` keeps the label short. A label is never wider than the room its axis leaves it: a longer text wraps onto several lines, and ends with an ellipsis where even that does not fit. `props.axisLabelStyle.maxWidth` (160 px) lowers the limit; `valueFormatter` writes the labels yourself.

## What is under the pointer

On every move, each series finds the point nearest to the pointer, and its **marker** marks it: a dot on a line, an outline around a bar. Markers belong to renderers: give another with `marker`, or none with `marker: false`.

```ts
new D3PLineRenderer({ bus, series, marker: false })
```

The tooltip, the cursor and the markers all read the same pointer event, and the work is done once.
