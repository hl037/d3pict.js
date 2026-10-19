# Titles and legend

A title with a subtitle, titles on the axes and a legend under the plot. Each one is a component added to the chart, and takes its room from the plot.

<ExampleLive id="titles" />

## What it shows

- **`D3PTitle`** puts a title and a subtitle over the plot.
- **`D3PAxisTitle`** puts a title on an axis, on its side. Without `props.text` it writes the display name of the axis.
- **`D3PLegendPanel`** lists the renderers under the plot (`placement` chooses the side, or a corner of the plot); a click on an entry shows or hides its renderer.
- None of them is there unless you add it. The [layout guide](/guide/layout) tells how they reserve their room, and how to write a title or a legend of your own with the same pieces.
