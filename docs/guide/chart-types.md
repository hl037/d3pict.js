# Chart types reference

How to build each chart type. They are all the same kind of thing: axes, one or several renderers, sometimes a transform that derives a series, sometimes annotations. The [gallery](/examples/gallery) shows each of them, with its source.

| Chart type | How |
|---|---|
| Line, area, scatter | `D3PLineRenderer`, `D3PAreaRenderer`, `D3PScatterRenderer` |
| Spline, step | `style.curve`: `monotone`, `step`, `stepBefore`, `stepAfter`, `basis`, `cardinal`, `catmullRom`, `natural` |
| Gaps in the data | `style.gaps: 'break'` (default `connect`) |
| Columns | `D3PBarRenderer` on a band axis; `count` and `index` group several series side by side |
| Horizontal bars | `D3PBarRenderer` with `orientation: 'horizontal'`, categories on a band axis at the left |
| Stacked, 100 %, streamgraph | `D3PStack` with `offset: 'none' \| 'expand' \| 'silhouette' \| 'wiggle'` (and `order`), drawn by areas or bars |
| Range area | a series with `columns: ['x', 'high', 'low']` and `D3PAreaRenderer({ props: { base: 'low' } })` |
| Range column, timeline | `D3PBarRenderer` with `base: 'start'` (and `orientation: 'horizontal'` for a timeline) |
| Histogram | `D3PHistogram` (or `d3pHistogram`) feeding `D3PBarRenderer`: bars take their width from the bin edges |
| Waterfall | `D3PWaterfall` feeding `D3PBarRenderer` with `style.colorBy: 'kind'` |
| Lollipop | `D3PBarRenderer` with `style.shape: 'lollipop'` |
| Candlestick | `D3PCandlestickRenderer` on a series with `open`, `high`, `low`, `close` |
| Box plot | `D3PBoxPlotRenderer`; `d3pBoxPlotRows(groups)` computes quartiles, whiskers and outliers from raw samples |
| Dumbbell | `D3PDumbbellRenderer` on a series with `start` and `end` |
| Bubble | `D3PBubbleRenderer` on a series with a `size` column |
| Heatmap | `D3PHeatmapRenderer` with a `D3PColorScale`, and a `D3PColorLegend` |
| Pie, donut, semi-donut | `D3PPieRenderer` in a `D3PPolarSystem` (`innerRadius`, `sweep`) |
| Radar | polar axes with `D3PRadarAngleAxisRenderer`, and lines or areas with `curve: 'straight'` and `closed: true` |
| Polar area (rose) | `D3PBarRenderer` on polar axes, categories on the angle |
| Radial bar, gauge | `D3PBarRenderer` with `orientation: 'horizontal'` on polar axes, categories on the radius; `sweep: 180` for a gauge |
| Funnel | `D3PFunnelRenderer` (no axes) |
| Slope | lines on a point axis with a blank category at each end |
| Sparkline | `d3pSparkline({ container, data, type })` |
| Annotations | `D3PAnnotationLine`, `D3PAnnotationBand`, `D3PAnnotationPoint`, `D3PAnnotationText` |

Not included: treemap, sunburst and icicle (they need hierarchical data), violin and raincloud, waffle, unit and beeswarm, and the multi-chart features (trellis, crossfilter, linked selections).

## Data

A series is a list of points; a point is `[x, value, ...others]`. The columns have names, and a renderer asks for the ones it needs:

```ts
// two columns, as always
new D3PSeries({ name: 'cpu', data: [[0, 3], [1, 5]] })

// several columns: a candlestick needs open, high, low and close
new D3PSeries({
  name: 'AAPL',
  columns: ['x', 'open', 'high', 'low', 'close'],
  primary: 'close',          // what a single value means (tooltip marker, legend, default domain)
  data: rows,
})
```

`primary` defaults to the second column. A renderer that needs columns the series lacks refuses it when attached, and says which ones.

Accepted inputs, detected on the first row:

| Input | Example |
|---|---|
| numbers, typed arrays | `[3, 5, 2]`: `x` is the index (two columns only) |
| positional rows | `[[0, 3], ['a', 5]]`, in the order of `columns` |
| object rows | `[{ x: 0, y: 3 }]`, or other keys and functions with `fields: { x: 't', y: (row) => row.v }` |
| column-oriented | `{ x: [0, 1], y: [3, 5] }` |
| any iterable of those | a `Set`, a generator, `Map.entries()` |

### Fitting the domains

`D3PAutoDomain.linkSeries(series, [dx, dy])` fits the second domain to **every value column** (a candlestick's lows and highs, not only its close). Columns that are not positions (`size`, `value`, `kind`, `color`, `label`) are left out; `domainColumns` overrides this. To map columns one by one, use names: `linkSeries(series, { x: dx, value: colors.domain })`.

### Derived series

A transform derives series from other series and keeps them up to date. The derived series are ordinary series that carry extra columns for the renderers:

| Transform | Derived columns |
|---|---|
| `D3PStack` | `x`, `y` (top of the layer), `y0` (its base), `value` (the original value, which the tooltip shows) |
| `D3PWaterfall` | `x`, `y`, `y0`, `value`, `kind` (`up`, `down`, `total`) |
| `D3PHistogram` | `x`, `y` (count), `x0`, `x1` (the edges of the bin) |

Areas and bars read a `y0` column by themselves, or the one named by `base`.

## Coordinate systems

Bars, areas, lines, scatter, bubbles and heatmaps draw in **any** coordinate system: rectangles in a cartesian one, arcs in a polar one, so the same renderer gives a column chart or a polar area. Candlesticks, box plots and dumbbells draw rectangles and lines and are cartesian only; pies are polar only; funnels use no system. A renderer that does not support a system says so.

A [polar system](/guide/concepts#coordinate-systems) can cover part of a circle (`sweep`), be a ring (`innerRadius`), start anywhere (`startAngle`) and be moved (`shift`, as fractions of the radius, to center a half disc).
