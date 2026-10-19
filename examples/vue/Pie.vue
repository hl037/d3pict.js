<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createPieScenario } from '../scenarios/pie'

const bus = useD3PBus()
const scenario = createPieScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { objects, system, tooltip, legend } = scenario

// #region script
// a pie is a donut with no hole
const shapes = { pie: 0, donut: 0.55 }
// #endregion script
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button v-for="(innerRadius, name) in shapes" :key="name" @click="system.props({ innerRadius })">{{ name }}</button>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
