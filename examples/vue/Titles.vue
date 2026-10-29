<script setup lang="ts">
import { D3PVChart, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createTitlesScenario } from '../scenarios/titles'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createTitlesScenario(ctx.bus))
const { objects, tooltip } = scenario
</script>

<template>
<!-- #region template -->
  <div class="chart-host">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
