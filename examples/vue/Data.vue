<script setup lang="ts">
import { D3PVChart, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createDataScenario } from '../scenarios/data'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createDataScenario(ctx.bus))
const { objects, tooltip, actions } = scenario
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button v-for="(run, name) in actions" :key="name" @click="run()">{{ name }}</button>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
