<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import type { D3PChart } from 'd3pict'
import { D3PVChart, D3PVTooltip, useD3PContext } from 'd3pict/vue'
import { createExportScenario } from '../scenarios/export'

const ctx = useD3PContext()
const scenario = ctx.destroyLater(createExportScenario(ctx.bus))
const { objects, tooltip, fileName } = scenario

// #region script
// the options of an export: the colors of the page are not the ones of the file
const themes = { light: {}, dark: { background: '#111827', color: '#e5e7eb' }, transparent: { background: null } }
const theme = ref<keyof typeof themes>('light')
const scale = ref(2)
const options = () => ({ ...themes[theme.value], scale: scale.value })

// the chart, once it is created, and a preview: the PNG that would be saved
const chart = shallowRef<D3PChart>()
const preview = ref('')
const showPreview = async () => (preview.value = await chart.value!.exportPNG(options()))
// #endregion script
</script>

<template>
<!-- #region template -->
  <div class="toolbar">
    <button :disabled="!chart" @click="chart?.downloadSVG(`${fileName}.svg`, options())">save SVG</button>
    <button :disabled="!chart" @click="chart?.downloadPNG(`${fileName}.png`, options())">save PNG</button>
    <button :disabled="!chart" @click="showPreview()">preview</button>
    <select v-model="theme" title="background">
      <option v-for="(_, name) in themes" :key="name" :value="name">{{ name }}</option>
    </select>
    <select v-model.number="scale" title="PNG scale">
      <option v-for="n in [1, 2, 4]" :key="n" :value="n">{{ n }}×</option>
    </select>
  </div>
  <div class="chart-host">
    <D3PVChart :objects="objects" @ready="chart = $event" />
  </div>
  <img v-if="preview" :src="preview" alt="preview of the PNG" style="align-self: flex-start; max-width: 100%; max-height: 220px; object-fit: contain; border: 1px solid #ccc; background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px" />
  <D3PVTooltip :tooltip="tooltip" />
<!-- #endregion template -->
</template>
