# Pie and donut

`D3PPieRenderer` draws a series of `[name, size]` pairs as slices: no axes, one renderer. It draws in a [polar coordinate system](/guide/concepts#coordinate-systems) and takes its center, radius, start angle, direction and hole from it, so the settings of the system shape both pies and polar charts. A donut is a pie in a system whose `innerRadius` is above 0.

Hover a slice to move it and see its share in the tooltip; click an entry of the legend to hide a slice, and the others fill the circle.

<ExampleLive id="pie" />

## What it does

- **Slices.** One per point with a positive size, in data order (or sorted with `sort: 'ascending' | 'descending'`). Values that are not positive numbers have no slice. `padAngle` (degrees) and `cornerRadius` (pixels) shape them; `style.colors` replaces the default palette.
- **Legend.** Its legend has one entry **per slice**, not one for the renderer: every renderer lists its own entries (`legendEntries()`), and an entry's `toggle()` shows or hides what it stands for. Custom legends use `entry.label`, `entry.color`, `entry.visible` and `entry.toggle()`.
- **Tooltip.** Without axes, there are no values to read under the pointer: the renderer answers by **testing the pointer against its slices** (its `probeHit`). The line shows the name, the size and the share (`label`, `percent`), and the box follows the pointer. Renderers of your own can do the same.
- **Hover.** The slice under the pointer moves outwards by `explode` pixels. It is the default **marker** of the pie (`marker: false` removes it, `hover: false` turns the effect off; the pie then does not ask for an interaction area).
- **Labels.** The share of each slice, above `labels.minPercent`; `labels.format` replaces the text.
- **Nested pies.** `radius: [from, to]` (fractions of the ring of the system) gives each pie its own band, so two pies on one chart form concentric rings.
- **Next to polar axes.** A pie can share the system, and the chart, of polar series: the renderer ignores the axes.

A pie needs a polar system: given a cartesian one, it throws an explicit error when attached.
