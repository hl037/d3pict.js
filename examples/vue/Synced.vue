<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createSyncedScenario } from '../scenarios/synced'

const bus = useD3PBus()
const scenario = createSyncedScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { charts, tooltip } = scenario
</script>

<template>
<!-- #region template -->
  <div class="chart-column">
    <div v-for="(chart, i) in charts" :key="i" style="flex: 1; min-width: 0; min-height: 0">
      <D3PVChart :objects="chart.objects" :margin="chart.margin" />
    </div>
  </div>
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
