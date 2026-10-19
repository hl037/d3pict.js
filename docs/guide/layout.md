# Step 6: titles and layout

A chart is a plot surrounded by room: the margins for the tick labels, and whatever you add around it. Titles, axis titles and a legend are objects that take their room from the plot.

<ExampleLive id="guide-6" :height="380" />

What changed:

- **`D3PTitle`** puts a title, and a subtitle, over the plot.
- **`D3PAxisTitle`** puts a title on an axis, against its tick labels. Without `props.text` it writes the `displayName` of the axis.
- **`D3PLegendPanel`** replaces the legend: it draws the entries itself, under the plot (`placement`), and takes room from it. `D3PLegendBundle` leaves the markup to you; use the panel when you want a legend that is just there.

None of them is there unless you add it. Each can be left out, changed, or replaced by a component of your own (see below).

## The standard components

| Component | What it does | Options |
|---|---|---|
| `D3PTitle` | A title over the plot, with an optional subtitle. | `side` (`top`, `bottom`), `size`, `props`: `text`, `subtitle`, `align`, `style` |
| `D3PAxisTitle` | The title of an axis, against its tick labels and centered on the plot; turned to read along a left or right axis. | `axis` (object or name), `size`, `props`: `text`, `align`, `gap`, `style` |
| `D3PLegendPanel` | A legend: one line per renderer entry; a click shows or hides it. | `placement`, `size`, `series`, `props`: `align`, `style` |

- Props are read and changed like those of any object: `title.props.align = 'start'`, `title.props({ subtitle: '' })`.
- A **legend panel** goes on a side of the plot (`top`, `right`, `bottom`, `left`: it takes room from the plot) or in a corner of it (`top-left`, `top-right`, `bottom-left`, `bottom-right`: it floats over the plot). `series` limits it to some renderers. With many entries it adapts: on top or bottom its strip grows with the lines the entries wrap onto, up to a third of the chart, then the list scrolls (`size` fixes it); on a side the names are cut and the list scrolls.
- An **axis title** sits `gap` pixels (6 by default; 4 to 10 is the usual range) from the tick labels of its axis, on the outer side. The labels are measured once the axis is drawn, so the title follows their width, and the plot keeps the room the axis and its title need together. With several axes on one side, each title is against its own axis: leave room for it between the axes with their `offset` (see [several axes](/guide/several-axes)).
- On a **polar** chart the axis titles are against the disc: under it for the angle, on its left for the radius.
- The strips of one side stack by `order`, whatever the order they are attached in: the title of the chart is the outermost, then the legend, and the titles of the axes are the closest to the plot.

## The room: the layout and its bands

Each chart has a layout, `chart.layout`, which divides the room into **bands**: a strip along one side that an object reserves, and that the plot gives up.

```ts
const band = chart.layout.reserve('top', 30)   // 30 px along the top, taken from the plot
band.rect()                                    // { x, y, width, height }, in the coordinates of the svg
band.size = 50                                 // the plot gives up 20 more pixels
band.release()                                 // and takes them back
chart.margin                                   // the margins with the bands: where the plot starts
chart.baseMargin                               // the `margin` given to the chart
```

A band has a `side`, a `span` (along the whole chart, or along the plot only, so that a title is centered over the plot) and an `order`: the lowest is the outermost (a title is 0, a legend 1, the title of an axis 2). When a band changes, the chart recomputes the plot and everything redraws, as when the container is resized.

## A slot: a band and an element

`D3PSlot` reserves a band on every chart it is attached to, and gives each one an HTML element placed on it. It is what the standard components are made of.

```ts
import { D3PSlot } from 'd3pict'

const note = new D3PSlot({ bus, side: 'bottom', size: 20 })   // `inside` floats over the plot instead, reserving nothing
note.addToChart(chart)
note.getContainer(chart)!.textContent = 'Source: the monitoring service'
```

With a framework, render into it with the component of the adapter:

```vue
<D3PVChart :objects="[x, y, line, note]" />
<D3PVSlot :slot="note">Source: the monitoring service</D3PVSlot>
```

```tsx
<D3PRChart objects={[x, y, line, note]} />
<D3PRSlot slot={note}>{() => <>Source: the monitoring service</>}</D3PRSlot>
```

## Your own components

The standard components use nothing a component of yours cannot use: a slot for the room, public props, the legend manager, the axes of the chart. This is `D3PTitle`, reduced to its principle:

```ts
import { D3PAttachable, D3PSlot, type D3PChart } from 'd3pict'

class Caption extends D3PAttachable<{}> {
  private readonly slot = new D3PSlot({ side: 'top', size: 24 })
  constructor(readonly text: string) {
    super('caption', [])
  }
  protected createData() {
    return {}
  }
  protected attached(chart: D3PChart) {
    this.slot.addToChart(chart)
    this.slot.getContainer(chart)!.textContent = this.text
  }
  protected override detached(chart: D3PChart) {
    this.slot.removeFromChart(chart)
  }
}
```

To replace a standard component, leave it out and attach yours. A legend of your own can start from `D3PLegendBundle`: it gives the entries (`legend.manager.e.changed`) and each entry toggles its renderer (`entry.toggle()`).
