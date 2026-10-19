<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVTooltip, useD3PBus } from 'd3pict/vue'
import { createShowcaseScenario } from '../scenarios/showcase'

const bus = useD3PBus()
const scenario = createShowcaseScenario(bus)
onBeforeUnmount(() => scenario.destroy())
const { charts, tooltip, actions, sizes, setSize } = scenario
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button v-for="(run, name) in actions" :key="name" @click="run()">{{ name }}</button>
    <select title="points of the last chart" @change="setSize(+($event.target as HTMLSelectElement).value)">
      <option v-for="n in sizes" :key="n" :value="n">{{ n.toLocaleString('en') }} points</option>
    </select>
  </div>
  <div class="chart-column">
    <div v-for="(chart, i) in charts" :key="i" style="flex: 1; min-width: 0; min-height: 360px">
      <D3PVChart :objects="chart.objects" :margin="chart.margin" />
    </div>
  </div>
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
