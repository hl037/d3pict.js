# Step 10: change the data

Assign the data of a series and everything that draws it follows. Nothing else is called.

<ExampleLive id="guide-10" :height="520" />

What changed:

- **`series.data = ...` is the whole API.** `[...series.data, row]` adds a row, `series.data.slice(1)` drops the first one, a new array replaces everything. The series announces the change; the renderers and the `D3PAutoDomain` linked to it react.
- **The domains fit the new data.** The auto domain sets `hours` and `degrees` again, so the new points are never outside. Without it, the domains keep the ranges you wrote.
- **The buttons are yours.** They are plain functions that assign a series; the chart does not know about them.

## The animation

A renderer moves from what is on screen to what the data says now. A point is paired with the point of the **same x value**, whatever its place on screen, so:

- a point that stays is not paired with its neighbor, even when the axes rescale;
- a new point is born on its nearest neighbor, and a removed one dies on it: the line grows or shrinks without jumping;
- a new bar grows from the base, and a removed one goes back to it.

A redraw takes 200 ms. If the data changes again during it, the next one starts from what is visible. Zooming and panning are not animated, so that dragging never lags behind the pointer. [Advanced](/guide/advanced#animations) gives the algorithm.

## Several series

Assign each series that changes. They redraw together, in the same frame. To change several charts at once, give them the same series: the [showcase](/examples/showcase) has one set of buttons for seven charts.

## Many points

A line of 100,000 points draws in about 70 ms, and pans, zooms and hovers at 60 frames per second; only the animation between two data sets slows down. The [showcase](/examples/showcase) has a chart to measure it on your machine.
