<script setup lang="ts">
import { onBeforeUnmount, reactive } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createToolsScenario } from '../scenarios/tools'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createToolsScenario(ctx.bus))
const { objects, toolbox, reset } = scenario

// #region script
// a button per tool, lit while the tool is active
const names = ['pan', 'zoom-selection', 'zoom-click', 'wheel-zoom', 'wheel-pan']
const active = reactive(Object.fromEntries(names.map((name) => [name, toolbox.isToolActive(name)])))
const stopTools = ctx.bus.on(toolbox.e.toolStateChanged, ({ tool, state }) => {
  if (tool.name in active) active[tool.name] = state
})
onBeforeUnmount(stopTools)
// #endregion script
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button v-for="name in names" :key="name" :class="{ on: active[name] }" @click="toolbox.setToolActive(name, !active[name])">{{ name }}</button>
    <button @click="reset.reset()">reset</button>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="objects" />
  </div>
<!-- #endregion template -->
</template>
