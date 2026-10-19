<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { GALLERY } from '../scenarios/gallery'

/** The chart of one scene of the gallery. */
const props = defineProps<{ id: string }>()
const scene = GALLERY.find((g) => g.id === props.id)!.build(useD3PBus())
onBeforeUnmount(() => scene.destroy())
</script>

<template>
  <div class="chart-host">
    <D3PVChart :objects="scene.objects" :margin="scene.margin" />
  </div>
  <D3PVLegend v-if="scene.legend" :legend="scene.legend" />
  <D3PVTooltip v-if="scene.tooltip" :tooltip="scene.tooltip" />
</template>
