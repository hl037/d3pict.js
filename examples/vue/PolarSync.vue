<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createPolarSyncScenario } from '../scenarios/polarsync'

const bus = useD3PBus()
const scenario = createPolarSyncScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { charts, tooltip, legend } = scenario
</script>

<template>
<!-- #region template -->
  <div class="chart-row">
    <div v-for="(chart, i) in charts" :key="i" style="flex: 1; min-width: 0; min-height: 0">
      <D3PVChart :objects="chart.objects" :margin="chart.margin" />
    </div>
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
