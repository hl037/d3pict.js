<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createPolarSyncScenario } from '../scenarios/polarsync'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createPolarSyncScenario(ctx.bus))
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
