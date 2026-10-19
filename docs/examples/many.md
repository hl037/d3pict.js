# Many series

Thirty-two series on one chart, with a title, titles on the axes and a legend.

<ExampleLive id="many" :height="520" />

## What it shows

- **The legend adapts.** Under (or over) the plot, `D3PLegendPanel` wraps its entries onto as many lines as they need and its strip grows by as much, taking the room from the plot. It stops at a third of the chart: beyond that the list scrolls in its strip. Give a number to `size` to fix the height. On a side of the plot the strip has a width of its own (140 px by default), long names are cut with an ellipsis (the whole name is the title of the entry), and the list scrolls.
- **The strips keep their order** whatever the number of entries: the title of the chart outermost, then the legend, then the title of the x axis.
- **The tooltip goes in columns**, a dozen lines each, so its box does not grow taller than the chart. The default content of the tooltip of `d3pDomTooltip`, `D3PVTooltip` and `D3PRTooltip` does it; with your own markup, the tooltip data (`series`) is yours to arrange.
- **Each series has its dot** where the pointer is, and the legend entries show or hide their line.
