<script setup lang="ts">
import { shallowRef } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import type { D3PBus, D3PChart } from 'd3pict'
import type { SingleScene } from '../core/scene'

/** The chart of a scenario that builds a single chart. */
const props = defineProps<{ build: (bus: D3PBus) => SingleScene }>()
const ctx = useD3PContext()
const scene = ctx.destroyLater(props.build(ctx.bus))
const chart = shallowRef<D3PChart>()
</script>

<template>
  <div v-if="scene.actions || scene.fileName" class="toolbar">
    <button v-for="(run, name) in scene.actions" :key="name" @click="run()">{{ name }}</button>
    <template v-if="scene.fileName">
      <button :disabled="!chart" @click="chart?.downloadSVG(`${scene.fileName}.svg`)">save SVG</button>
      <button :disabled="!chart" @click="chart?.downloadPNG(`${scene.fileName}.png`)">save PNG</button>
    </template>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="scene.objects" :margin="scene.margin" @ready="chart = $event" />
  </div>
  <D3PVLegend v-if="scene.legend" :legend="scene.legend" />
  <D3PVTooltip v-if="scene.tooltip" :tooltip="scene.tooltip" />
</template>
