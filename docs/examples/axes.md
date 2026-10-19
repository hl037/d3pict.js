# Several axes

Four Y axes (two on each side, one of them logarithmic) and two X axes on one chart, each series against its own axes. The wheel zooms time, dragging pans.

<ExampleLive id="axes" />

## What it shows

- **Four Y axes.** Two on the left, two on the right: the `offset` option moves an axis away from the plot, outward, so several axes stack on one side. Make room for them with the chart's margins.
- **A logarithmic axis.** `scaleType: 'log'` on the latency axis; the other three are linear.
- **Two X axes.** The bottom one shows the hour, the top one the day; both read **one** `D3PAxisDomain`, so zooming the time moves them together.
- **A title per axis.** Each `D3PAxisTitle` sits against the labels of its own axis, in the color of its series. The second axis of each side has an `offset` of 84 px, which leaves room for the title of the first one between the two. The chart title and the legend (`D3PTitle`, `D3PLegendPanel`) are outside of them, whatever the order they are added in.
- **Each series against its axes.** A renderer names the axes it draws against (`axes: ['hour', 'latency']`); everything else (cursor, tooltip, legend) reads the renderers. The axes are tinted like their series with the `postProcess` hook.
- **Tools on the X axes only.** `axes: ['hour']` keeps the Y ranges fixed: the wheel zooms time, dragging pans it.
