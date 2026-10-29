<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createLinesScenario } from '../scenarios/lines'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createLinesScenario(ctx.bus))
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
