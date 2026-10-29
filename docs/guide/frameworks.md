# Step 12: Vue and React

The tabs of the guide showed the same chart for the three environments. This page says what the adapters do.

The objects (series, axes, renderers, tools...) are the same classes everywhere. What differs is how a chart is mounted and how HTML (a tooltip, a legend, your own content) gets in. The adapters are in `d3pict/vue` and `d3pict/react`; their classes are prefixed `D3PV` and `D3PR`.

## Vue

```ts
import { createApp } from 'vue'
import { D3PVPlugin } from 'd3pict/vue'

createApp(App).use(D3PVPlugin) // the app gets a bus of its own
```

```vue
<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'

const ctx = useD3PContext()
// the objects made with the context are destroyed when the component goes away
const series = ctx.newSeries({ name: 'temperature', data: [[0, 12], [4, 9], [8, 14]] })
const line = ctx.newLineRenderer({ series })
const tooltip = ctx.newTooltip()
const legend = ctx.newLegendBundle()
// ... the axes, the domains, the rest
const objects = [line, tooltip, legend]
</script>

<template>
  <div style="height: 400px">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
</template>
```

- **`D3PVChart`** creates the chart in a `div` that follows its container and attaches `objects` (add or remove some and the chart follows). It also creates the interaction area. Its props: `objects`, `margin`, `width`, `height`, `name`.
- **`D3PVTooltip`**, **`D3PVLegend`** and **`D3PVSlot`** put Vue content in the HTML elements of a tooltip, a legend or a slot. They have a default content; a default slot replaces it, with `data` and `chart`:

```vue
<D3PVTooltip :tooltip="tooltip">
  <template #default="{ data }">
    <div v-for="s in data.series" :key="s.renderer.id">{{ s.label ?? s.renderer.name }}: {{ s.y }}</div>
  </template>
</D3PVTooltip>
```

- **`useD3PContext()`** returns the context, [described below](#the-context). Call it in `setup()`.
- Keep D3Pict objects out of Vue's deep reactivity (`shallowRef`, or plain `const` in `setup`): they are classes, not state.

## React

```tsx
import { D3PRChart, D3PRLegend, D3PRProvider, D3PRTooltip, useD3PContext } from 'd3pict/react'

function build(ctx: D3PContext) {
  const series = ctx.newSeries({ name: 'temperature', data: [[0, 12], [4, 9], [8, 14]] })
  const line = ctx.newLineRenderer({ series })
  const tooltip = ctx.newTooltip()
  const legend = ctx.newLegendBundle()
  // ... the axes, the domains, the rest
  return { objects: [line, tooltip, legend], tooltip, legend }
}

function Chart() {
  // the objects made with the context are destroyed when the component goes away
  const ctx = useD3PContext()
  const [scene, setScene] = useState<ReturnType<typeof build>>()
  // make the objects in an effect, not while rendering: safe in StrictMode
  useEffect(() => setScene(build(ctx)), [ctx])
  if (!scene) return null
  return (
    <>
      <div style={{ height: 400 }}>
        <D3PRChart objects={scene.objects} />
      </div>
      <D3PRLegend legend={scene.legend} />
      <D3PRTooltip tooltip={scene.tooltip} />
    </>
  )
}

<D3PRProvider><Chart /></D3PRProvider>
```

- **`D3PRProvider`** gives its subtree a bus of its own; without it, the global bus is used.
- **`D3PRChart`**, **`D3PRTooltip`**, **`D3PRLegend`** and **`D3PRSlot`** work like their Vue twins. Their content comes from a function of the data and the chart: `<D3PRTooltip tooltip={tooltip}>{(data) => ...}</D3PRTooltip>`.

## The context

`useD3PContext()` is the way to make the objects of a chart in a component. The context makes them with the bus of the app, and destroys them when the component goes away, so there is no list of objects to keep and no cleanup to write. It has a method for each object of the library, named after its class without the `D3P`:

| With the bus | With the context |
|---|---|
| `new D3PSeries({ bus, name: 'a' })` | `ctx.newSeries({ name: 'a' })` |
| `new D3PAxis({ bus, name: 'x', domain })` | `ctx.newAxis({ name: 'x', domain })` |
| `new D3PLineRenderer({ bus, series })` | `ctx.newLineRenderer({ series })` |
| `new D3PCursorIndicator({ bus })` | `ctx.newCursorIndicator()` |

The options are the ones of the class, without `bus`, and are optional when the class does not need any. `ctx.bus` is the bus, for what you make yourself, and `ctx.destroyLater(object)` destroys an object with the others and returns it:

```ts
const mine = ctx.destroyLater(new MyOwnObject({ bus: ctx.bus }))
```

Objects are destroyed in the reverse order of their creation: a renderer before its series. In React, make them in an effect: the component may render twice, and `StrictMode` mounts, unmounts and mounts it again, which destroys what the first mount made. The context stays usable after that, so the second mount makes its objects again. The context is also available without a framework: `d3pContext(bus)` in `d3pict`, and `ctx.destroy()` when you are done.

## The bus

The bus is how objects talk. Each Vue app and each `D3PRProvider` has its own, so two applications on one page do not hear each other. Objects and the chart they are attached to must share one bus: an error says so when they do not. See [Advanced](/guide/advanced) for what goes through it.
