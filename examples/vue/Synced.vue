<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createSyncedScenario } from '../scenarios/synced'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createSyncedScenario(ctx.bus))
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
