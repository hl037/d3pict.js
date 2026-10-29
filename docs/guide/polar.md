# Step 9: polar charts

A polar chart draws the same series with an angle and a distance from the center. Only the axes change.

<ExampleLive id="guide-9" :height="460" />

What changed:

- **The axes have other positions.** `position: 'angle'` makes the hour an angle, `position: 'radius'` makes the temperature a distance from the center. The domains, the series, the renderers, the cursor, the tooltip and the legend are the ones of the cartesian chart.
- **The humidity is gone,** to keep one chart that reads well: a polar system has one angle and one radius.
- **The wheel zooms the radius only.** The zoom tool is told which axis it acts on, `axes: ['temperature']`: zooming an angle cuts the circle and makes the chart hard to read. Dragging still pans. to keep one chart that reads well: a polar system has one angle and one radius.
- The titles are against the disc: the angle's under it, the radius's on its left.

The renderers do not know which geometry they draw in. They ask their **coordinate system** to place points: the cartesian system gives them a rectangle, the polar one a disc.

## The polar system

The system is created with the first polar axis, with its default settings. To change them, create it yourself and attach it before the axes:

```ts
const polar = new D3PPolarSystem({ bus, props: { startAngle: 90, clockwise: false, innerRadius: 0.4 } })
```

| Prop | Is |
|---|---|
| `startAngle` | where the angle domain starts, in degrees (0 is up) |
| `clockwise` | the direction the angle grows in |
| `sweep` | the part of the circle that is covered, in degrees: 180 is a half circle (a gauge) |
| `innerRadius` | the hole, as a fraction of the radius: a ring, a donut |
| `shift` | moves the center, as fractions of the radius |
| `padding` | pixels kept around the disc for the angle labels |
| `reach` | how far beyond the disc the pointer still counts as over the chart (112 px) |

Values outside of the domain have no place: a polar line is cut at the angle range and clipped to the ring, never wrapped around.

## Same data, two geometries

Swap the positions and the chart changes. The [cartesian and polar example](/examples/polar) does it with a button. The radius axis can follow the pointer (`D3PCursorRadiusAxisRenderer`).

## Pies and radars

A pie is a renderer in a polar system (`D3PPieRenderer`; a `D3PPolarSystem` with an `innerRadius` makes a donut). A radar uses polar axes with `D3PRadarAngleAxisRenderer`; a rose or radial bars use `D3PBarRenderer`. See the [chart types](/examples/gallery).

## Charts that follow each other

Two charts whose axes share one `D3PAxisDomain` stay in step, a cartesian one and a polar one included: [cartesian and polar, synchronized](/examples/polarsync).
