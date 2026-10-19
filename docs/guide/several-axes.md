# Step 7: several axes

Two quantities in different units can share a chart: give each its own axis. Temperature is on the left, humidity on the right.

<ExampleLive id="guide-7" :height="380" />

What changed:

- **A second y axis.** `yRight` is on the `right` side, and has a domain of its own (`percent`, in %).
- **A renderer names its axes.** A renderer takes the first x axis and the first y axis of the chart. `humidityLine` has to say which ones it draws against: `axes: ['hour', 'humidity']`, by name. The renderers of the temperature use the defaults, since the `temperature` axis was attached first.
- **A title for the new axis,** against its own labels (`D3PAxisTitle` with `axis: yRight`).

## More than one axis on a side

An axis is at `bottom`, `top`, `left` or `right`. To put two on the same side, move the second one away from the plot with `offset` (in pixels). Leave room for the title of the first one between them: the labels, a gap and the title take about 80 px.

```ts
const cpu = new D3PAxis({ bus, name: 'cpu', domain: dCpu, position: 'left', offset: 84 })
```

Give the titles, and the axes, the color of their series (`props.style.color` of the title; the `postProcess` prop of the axis receives its SVG group) so that each one is clearly the axis of its series.

## Tools, cursor and tooltip

- The **cursor** shows one label per axis, on the axis, at the value under the pointer.
- The **tooltip** lists the series, each in the units of its own axis.
- A **tool** acts on every axis unless told otherwise (`axes: ['hour']`): zoom the time without touching the units of the y axes.

See the [several axes example](/examples/axes) for four y axes, one of them logarithmic, and two x axes on one domain.
