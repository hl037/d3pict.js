<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createManyScenario } from '../scenarios/many'

const bus = useD3PBus()
const scenario = createManyScenario(bus)
onBeforeUnmount(() => scenario.destroy())
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
