# Cartesian and polar, synchronized

The same data on a cartesian and a polar chart that share their domains. Drag on one and the other follows; hover one and the pointer shows its value on both.

<ExampleLive id="polarsync" />

## How the synchronization works

- **Shared domains.** The cartesian and the polar axes are built on the same two `D3PAxisDomain` objects (the angle and the magnitude): writing one is seen by both charts, which each draw it in their own geometry. Dragging the angle on the cartesian chart turns the polar one, and the other way round.
- **The same names.** Both charts name their axes `angle` and `magnitude`, so the renderers, the cursor, the tooltip and the tools attached to both find their axes on each. They are the same objects, attached twice.
- **The pointer follows across.** Hover one chart and the cursor, the tooltip and the dots appear on the other, at the same angle: each chart reads the pointer event through the [probe](/guide/advanced#the-probe-and-markers), by axis name.
- **A polar chart reads the pointer beyond its ring.** Within the `reach` of its system (112 px by default) the pointer still gives the angle and the outer magnitude, so the dots and the tooltip do not vanish when it leaves the disc. The radius axis that follows the pointer stops at the same distance.
