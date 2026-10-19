# Step 2: axes and domains

An axis turns the values of your data into positions. Two things take part: its **domain**, the range of values it shows, and its **scale**, the function that maps that range to pixels. You write the domain; the axis builds the scale from it and from the size of the chart.

<ExampleLive id="guide-2" :height="340" />

What changed:

- **The domains are variables.** `hours` and `degrees` are `D3PAxisDomain` objects, given to the axes. A domain is a plain object that holds a range, nothing else: not a scale, not pixels.
- **An auto domain fits them to the data.** `D3PAutoDomain.linkSeries(series, [xDomain, yDomain])` sets the domains to the extent of the series, and keeps them up to date when the data changes. Leave it out to keep the ranges you wrote.
- **The axes are set with `props`.** `tickCount` is the number of ticks wanted, `tickFormat` writes a value, `grid` draws the grid lines, `displayName` is the name shown in the cursor labels and the titles.

## Domains are shared and writable

The domain of an axis can be read and written: `hours.domain = [6, 18]` shows only the day, and the axis follows. This is all the zoom and the pan do (they write domains), and it is how charts stay in step: two axes built on the same `D3PAxisDomain` always show the same range, even on two different charts.

## Kinds of scale

`scaleType` on the axis chooses the scale.

| `scaleType` | For | Domain |
|---|---|---|
| `linear` (default) | numbers | `[min, max]` |
| `time`, `utc` | dates | `[start, end]` as `Date`s |
| `log` | numbers over several orders of magnitude | `[min, max]`, both above 0 |
| `symlog` | the same, with negative values and zero | `[min, max]` |
| `pow`, `sqrt` | areas and other power laws | `[min, max]` |
| `band` | categories drawn as bands (bars) | the list of categories |
| `point` | categories drawn as points (a line over categories) | the list of categories |

`scaleOptions` passes options to the scale: the `base` of a `log` scale, the `exponent` of a `pow` one.
