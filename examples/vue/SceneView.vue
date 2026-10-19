<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import type { SingleScene } from '../core/scene'

/** The chart of a scenario that builds a single chart. */
const props = defineProps<{ build: (bus: ReturnType<typeof useD3PBus>) => SingleScene }>()
const scene = props.build(useD3PBus())
onBeforeUnmount(() => scene.destroy())
</script>

<template>
  <div v-if="scene.actions" class="toolbar">
    <button v-for="(run, name) in scene.actions" :key="name" @click="run()">{{ name }}</button>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="scene.objects" :margin="scene.margin" />
  </div>
  <D3PVLegend v-if="scene.legend" :legend="scene.legend" />
  <D3PVTooltip v-if="scene.tooltip" :tooltip="scene.tooltip" />
</template>
