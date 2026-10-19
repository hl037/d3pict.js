# Step 11: Vue and React

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
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'

const bus = useD3PBus()
// ... create the series, axes, renderers, tooltip and legend with `bus`
onBeforeUnmount(() => /* destroy them */ {})
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

- Keep D3Pict objects out of Vue's deep reactivity (`shallowRef`, or plain `const` in `setup`): they are classes, not state.

## React

```tsx
import { D3PRChart, D3PRLegend, D3PRProvider, D3PRTooltip, useD3PBus } from 'd3pict/react'

function Chart() {
  const bus = useD3PBus()
  const [scene, setScene] = useState<Scene>()
  // create the objects in an effect, and destroy them in its cleanup: safe in StrictMode
  useEffect(() => {
    const created = build(bus)
    setScene(created)
    return () => created.destroy()
  }, [bus])
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

## The bus

The bus is how objects talk. Each Vue app and each `D3PRProvider` has its own, so two applications on one page do not hear each other. Objects and the chart they are attached to must share one bus: an error says so when they do not. See [Advanced](/guide/advanced) for what goes through it.
