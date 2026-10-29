# Step 11: export

Save the chart as an SVG file or as a PNG image. The chart does it itself.

<ExampleLive id="guide-11" :height="520" />

What changed:

- **`chart.downloadSVG(name)` and `chart.downloadPNG(name)`.** The browser downloads the file under that name. Two buttons call them.
- **Where the chart object comes from.** In the core, it is the `D3PChart` you made. In Vue, `D3PVChart` emits `ready` with the chart (`@ready="chart = $event"`). In React, `D3PRChart` calls its `onReady` prop with it.
- **Nothing else to set up.** The titles, the axis titles and the legend are in the file, and so are the axes, the grid and the data.

## What is in the file

The file is what a still chart looks like. What only means something while the pointer is there is left out: the area that takes the pointer, the cursor, the markers and the tooltip. The file does not depend on the page either: it has its own background, its own text color and the fonts of the chart, so it reads the same in a viewer, a document or a slide.

## Options

Both methods take the same options after the file name:

```ts
chart.downloadSVG('temperature.svg', { background: '#111827', color: '#e5e7eb' })
chart.downloadPNG('temperature.png', { scale: 3, background: null })
```

| Option | Is | Default |
|---|---|---|
| `background` | The color behind the chart. `null` leaves it transparent. | `'#fff'` |
| `color` | What `currentColor` is in the file: the text and the lines that follow the color of the page. Give a light one with a dark `background`. | `'#000'` |
| `scale` | PNG only: the pixels of the image for each pixel of the chart. | `2` |
| `fonts` | Write the web fonts the chart uses into the file. `false` makes a smaller file, written with the fonts of the machine. | `true` |

A chart on a dark page needs both `background` and `color`: the file is not the page, so it does not follow its theme.

## SVG or PNG

- **SVG** keeps everything as it is: text stays text, and the file scales to any size. Use it for documents and for anything that gets printed. The fonts are inside, which adds their weight to the file: a font is often 20 to 100 KB. `fonts: false` leaves them out.
- **PNG** is a picture of the chart, `scale` times its size. Use it where an image is needed (a message, a slide, a page that does not take SVG). The web fonts of your page are written into the image, so the text looks as it does on screen.

## Without a download

`chart.exportSVG(options)` returns a promise of the text of the SVG file, and `chart.exportPNG(options)` returns a promise of a PNG data URL. Use them to send the chart to a server, copy it to the clipboard or show a preview. The [export example](/examples/export) shows a preview.

## Fonts

A file is read without the page: an SVG opened in a viewer, or loaded as an image to make a PNG, does not see the fonts of the page, and its text would fall back to another font. So the export writes into the file the `@font-face` of the web fonts the chart uses, with the font files inlined. Only what the text needs is written: the fonts and weights in use, and the subsets of a font (`unicode-range`) that cover the characters of the chart. The font of the page is also written on the file, for the text that does not name one.

The rules are read from the style sheets of the page, and the files are fetched (once). So:

- A style sheet from another origin that does not allow it (no CORS headers) cannot be read, and neither can a font file from a server that does not allow it. Google Fonts allows both. That font falls back to a similar one.
- A font loaded by script (`new FontFace(...)`) cannot be read back, and is not written.
- A font that is only installed on your machine is not written: it is not a web font.

## Limits

- A browser that does not let HTML into an image (Safari, at the time of writing) draws the PNG without the titles and the legend, and says so in the console. The SVG keeps them.
- HTML you add yourself (an anchor, a slot) is part of the file as long as it only uses what a `foreignObject` can draw. Pointer-driven parts are always left out.
