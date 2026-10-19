<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createLinesScenario } from '../scenarios/lines'

const bus = useD3PBus()
const scenario = createLinesScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { objects, margin, tooltip, legend } = scenario
</script>

<template>
<!-- #region template -->
  <div class="chart-host">
    <D3PVChart :objects="objects" :margin="margin" />
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
