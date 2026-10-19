# Adding and removing data

Assign the data of a series and everything that draws it follows: the bars, the line, the tooltip, and the axes when an auto domain fits them.

<ExampleLive id="data" :height="420" />

## What it shows

- **Changing the data is assigning it.** `series.data = [...series.data, [x, value]]` adds a point; `series.data.slice(1)` drops the first one. There is no other call: a series announces that its data changed, and the renderers and the auto domain linked to it react.
- **The chart moves from what was there to what is there now.** A new point is born on its nearest neighbor and a removed one dies on it, so a line grows or shrinks without jumping; a new bar grows from the base and a removed one goes back to it. The transition lasts 200 ms, and starts again from what is on screen if the data changes during it. [Advanced](/guide/advanced#animations) tells the algorithm.
- **The axes fit the new data.** The `D3PAutoDomain` linked to the series sets the x and y domains again each time. Without it, the domains keep the ranges you wrote and new points may fall outside.
- **Zoom and pan do not animate.** A change of the domain is drawn at once, so that dragging never lags behind the pointer.
