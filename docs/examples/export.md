# Export

Save a chart as an SVG file or a PNG image. Choose a background and the size of the PNG, then save, or preview the PNG under the chart.

<ExampleLive id="export" :height="560" />

## What it shows

- **The chart saves itself.** `chart.downloadSVG(name, options)` and `chart.downloadPNG(name, options)` make the browser download a file. The chart object comes from `new D3PChart` in the core, from the `ready` event of `D3PVChart` in Vue and from the `onReady` prop of `D3PRChart` in React.
- **The file is not the page.** It has a background (white unless you say otherwise), a color for the text and the web fonts of the chart, so it reads the same anywhere. On a dark page, give both: `{ background: '#111827', color: '#e5e7eb' }`. `background: null` leaves it transparent, which the preview shows as a checkerboard.
- **What is on screen only for the pointer is left out.** The title, the axis titles, the legend and the goal line are in the file. The cursor, the markers and the tooltip are not, even while you hover the chart when you save.
- **`exportPNG` and `exportSVG` do not download.** They return a promise of a data URL and of the text of the file: the preview is `exportPNG` put in an `<img>`. Use them to send the chart to a server or to copy it.
- **The scale is the size of the PNG.** `scale: 2` gives twice the pixels of the chart, for a screen with a high density or a print.

The [guide](/guide/export) goes through the options, and every chart of the [showcase](/examples/showcase) has its own SVG and PNG buttons.
