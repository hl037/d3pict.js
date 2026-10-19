# Step 5: zoom and pan

Tools let the user act on the chart. They do one thing: write the domains of the axes.

<ExampleLive id="guide-5" :height="340" />

What changed:

- **`D3PToolbox`** holds tools and says which ones are active. `setToolActive('pan')` turns a tool on.
- **`D3PPanTool`** moves the domains when the pointer drags the plot. **`D3PWheelZoomTool`** zooms around the pointer with the wheel. **`D3PResetTool`** brings the domains back to where they were.

The axes follow the domains, and so does everything drawn from them: the lines, the grid, the cursor.

## The tools

| Tool | Name | Does |
|---|---|---|
| `D3PPanTool` | `pan` | drag to move |
| `D3PZoomSelectionTool` | `zoom-selection` | drag a rectangle to zoom to it |
| `D3PClickZoomTool` | `zoom-click` | click to zoom in |
| `D3PWheelZoomTool` | `wheel-zoom` | wheel to zoom around the pointer |
| `D3PWheelPanTool` | `wheel-pan` | wheel to move along x |
| `D3PResetTool` | `reset` | back to the first view |

## Choose what a tool acts on

By default, a tool acts on every axis of the chart. The `axes` option names the ones it moves:

```ts
new D3PPanTool({ bus, axes: ['hour'] }) // moves x, leaves the y range alone
```

`new D3PToolbox({ bus, mutuallyExclusiveGroups: [['pan', 'zoom-selection']] })` makes tools exclusive: turning one on turns the others of its group off.

## The wheel and the page

A chart with a wheel tool takes the wheel while the pointer is over it. A chart without one lets the page scroll.
