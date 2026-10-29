<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { GALLERY } from '../scenarios/gallery'

/** The chart of one scene of the gallery. */
const props = defineProps<{ id: string }>()
const ctx = useD3PContext()
const scene = ctx.destroyLater(GALLERY.find((g) => g.id === props.id)!.build(ctx.bus))
</script>

<template>
  <div class="chart-host">
    <D3PVChart :objects="scene.objects" :margin="scene.margin" />
  </div>
  <D3PVLegend v-if="scene.legend" :legend="scene.legend" />
  <D3PVTooltip v-if="scene.tooltip" :tooltip="scene.tooltip" />
</template>
