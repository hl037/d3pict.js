# Step 8: other kinds of chart

The kind of chart is the renderer. The axes, the series, the cursor, the tooltip stay as they are.

<ExampleLive id="guide-8" :height="380" />

What changed:

- **Bars instead of a line.** The humidity series is the same; `D3PBarRenderer` replaces `D3PLineRenderer`. `barWidth` is in pixels on a continuous axis, and a fraction of the band on a band axis.
- **The bars are first in the list of objects,** so they are drawn behind the lines: renderers draw in the order they are attached.

To put an area under a line, add a second renderer on the same series: `new D3PAreaRenderer({ bus, series, marker: false })`. Its `marker: false` leaves the dot of the tooltip to the line above it.

## The renderers

| Renderer | Draws |
|---|---|
| `D3PLineRenderer`, `D3PAreaRenderer`, `D3PScatterRenderer` | lines, areas (down to zero, to a base, or between two series), points |
| `D3PBarRenderer` | columns, horizontal bars, grouped or stacked bars, lollipops, ranges; bars on polar axes |
| `D3PBubbleRenderer` | points of a size given by a third column |
| `D3PCandlestickRenderer`, `D3PBoxPlotRenderer`, `D3PDumbbellRenderer` | series with several values per point |
| `D3PHeatmapRenderer` | a grid colored by a value (`D3PColorScale`, `D3PColorLegend`) |
| `D3PPieRenderer`, `D3PFunnelRenderer` | parts of a whole: no axes |

Some chart types need a transform to prepare the series: `D3PStack` (stacked areas and bars, streamgraphs), `D3PWaterfall`, `D3PHistogram`. Annotations (`D3PAnnotationLine`, `D3PAnnotationBand`, `D3PAnnotationPoint`, `D3PAnnotationText`) mark values of the axes and follow zooms. They stop at the edge of the plot: a mark whose value is outside the axis is not drawn, and neither is its label.

Each chart type has [a page](/examples/gallery) with the chart and the code that makes it, and the [chart types reference](/guide/chart-types) says how each one is built.
