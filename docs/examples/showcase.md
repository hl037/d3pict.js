---
pageClass: wide-example
aside: false
---

# Showcase

Seven charts that combine most features of the library. The four buttons above them change the data of all the charts at once: **add a point**, **remove the last**, **remove the first**, **replace**. Each chart takes the change in its own way: hours and days are added, quarters, months, regions and hours of the heatmap are added as categories (the rose gets more petals), and the axes fit the new data.

<ExampleLive id="showcase" :height="2700" />

## The charts

1. **Time series, four Y axes.** Two axes on each side (`offset` stacks them), one of them **logarithmic**, and two X axes (hour and day) on one domain. Bars, a **spline** with a **gap** (`gaps: 'break'`), a **range area** (`base`), points, four **annotations** (band, line, point; the line is on the log axis), a legend, pan and wheel zoom on the X axis only.
2. **Categories.** **Grouped columns** (`count` and `index`) on a band axis, a line on a second Y axis, an annotation.
3. **Two polar systems in one chart.** A **stacked rose** (`D3PStack`, bars on polar axes) and a **donut** drawn in a second, smaller `D3PPolarSystem`. The radius axis follows the pointer.
4. **A candlestick chart and its volume**, two charts sharing **one X axis**: pan or zoom one and the other follows, and the pointer shows its value on both. A moving average, and the Y axis fitted to the lows and highs (`D3PAutoDomain`).
5. **Volume bars**, the second chart of that pair.
6. **A heatmap** with its color scale and legend (`D3PColorScale`, `D3PColorLegend`).
7. **Many points.** One line of 1,000, 10,000 or 100,000 points, chosen in the list above the charts, to see what a chart costs as the data grows. Its subtitle gives the time from the assignment of the data to the first drawing, generation of the points included. Pan, zoom and hover work the same at any size; only the animation between two data sets slows down with 100,000 points.

Every chart type also has [its own page](/examples/gallery), with the code of that type alone.
