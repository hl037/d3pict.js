<script setup lang="ts">
import type { D3PChart } from 'd3pict'
import { D3PVChart, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createShowcaseScenario } from '../scenarios/showcase'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createShowcaseScenario(ctx.bus))
const { charts, tooltip, actions, sizes, setSize } = scenario

// #region script
// the charts, once they are created: each one saves itself as a file
const saved: D3PChart[] = []
// #endregion script
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
    <div v-for="(chart, i) in charts" :key="i" style="position: relative; flex: 1; min-width: 0; min-height: 360px">
      <D3PVChart :objects="chart.objects" :margin="chart.margin" @ready="(c) => (saved[i] = c)" />
      <div class="toolbar" style="position: absolute; top: 4px; right: 8px; z-index: 2">
        <button @click="saved[i]?.downloadSVG(`${chart.name}.svg`)">SVG</button>
        <button @click="saved[i]?.downloadPNG(`${chart.name}.png`)">PNG</button>
      </div>
    </div>
  </div>
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
