# Step 3: several series and their style

A chart can hold any number of series. Each one is drawn by a renderer, and a renderer is told how to look with its `props`.

<ExampleLive id="guide-3" :height="340" />

What changed:

- **A second series, a second renderer.** `feelsLike` is linked to the same domains, so both lines share the axes. A renderer has no other idea of the data than its series.
- **The style is a prop.** `props: { style: { color, curve, strokeWidth } }`. `curve` joins the points: `linear` (default), `monotone`, `step`, `stepBefore`, `stepAfter`, `basis`, `cardinal`, `catmullRom`, `natural`. Without a color, a renderer takes one from its name.

## Props

Every object that has options has a `props`. Read a prop (`line.props.style.color`), change a part (`line.props({ style: { color: 'tomato' } })`), or assign a field (`line.props.style.strokeWidth = 4`): the chart redraws by itself.

## What a series can hold

A series is a list of rows. The first column is x, the second the main value; more columns are named and can be read by renderers (a range area has a `min` and a `max`, a candlestick has an `open`, a `high`, a `low` and a `close`).

```ts
// rows: [x, value]
new D3PSeries({ bus, name: 'a', data: [[0, 12], [4, 9]] })
// a range: the columns are named, and a renderer picks the ones it needs
new D3PSeries({ bus, name: 'band', columns: ['x', 'max', 'min'], data: [[0, 20, 10], [4, 18, 8]] })
// numbers only: the index is x
new D3PSeries({ bus, name: 'b', data: [12, 9, 14] })
// objects: say where each column comes from (a key, or a function of the row)
new D3PSeries({ bus, name: 'c', data: rows, fields: { x: 'date', y: 'close' } })
// columns: one array per column
new D3PSeries({ bus, name: 'd', data: { x: [0, 4], y: [12, 9] } })
```

To change the data of a series, assign it: `series.data = [...series.data, [x, value]]`. Everything that draws it follows, with an animation (see [step 10](/guide/changing-data) and the [adding and removing data example](/examples/data)).

A missing value (`NaN`) leaves a gap in the line when the style has `gaps: 'break'`; by default the line goes over it.
