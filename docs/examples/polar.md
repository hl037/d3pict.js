# Cartesian and polar

The same series, the same line and area renderers, the same tooltip, cursor, legend and tools, drawn on cartesian axes or on polar ones. **Only the axes change**: switch with the buttons. In the code below, `axes` holds the two sets of axes and the chart takes one of them, plus everything else.

In polar, dragging turns the angle, the wheel zooms the radius, and the radius axis follows the pointer (`D3PCursorRadiusAxisRenderer`). The data covers three turns, and what is outside of the angle domain is not drawn: that is why the pattern keeps filling the circle while it turns.

<ExampleLive id="polar" />

## How the switch works

An axis has a `position`. `bottom`, `top`, `left` and `right` put it on a side of a cartesian chart; `angle` and `radius` make it the first and second dimension of a polar system (`D3PAngleAxis` and `D3PRadiusAxis` are shortcuts). The renderers read the axes of the chart and ask their coordinate system to project the points, so they do not know which geometry they draw in.

```ts
// cartesian
new D3PAxis({ name: 'angle', domain: angle, position: 'bottom' })
new D3PAxis({ name: 'radius', domain: radius, position: 'left' })

// polar: same names, same domains
new D3PAxis({ name: 'angle', domain: angle, position: 'angle' })
new D3PAxis({ name: 'radius', domain: radius, position: 'radius' })
```

Each axis is drawn by an [axis renderer](/guide/advanced#axis-renderers), chosen after the position. An axis refuses a renderer that does not support its position, with an explicit message.
