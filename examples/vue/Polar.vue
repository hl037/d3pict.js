<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createPolarScenario } from '../scenarios/polar'

const bus = useD3PBus()
const scenario = createPolarScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { axes, shared, tooltip, legend } = scenario

// #region script
// the axes are the only thing that depends on the geometry: swap them, keep the rest attached
const geometry = ref<'cartesian' | 'polar'>('polar')
// #endregion script
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button v-for="g in ['cartesian', 'polar'] as const" :key="g" :class="{ on: geometry === g }" @click="geometry = g">{{ g }}</button>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="[...axes[geometry], ...shared]" />
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
