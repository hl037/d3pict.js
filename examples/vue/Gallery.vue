<script setup lang="ts">
import { onBeforeUnmount, shallowRef, watch, ref } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from '../../src/vue'
import { GALLERY, type GalleryScene } from '../scenarios/gallery'
import { t, type MessageKey } from '../shared/i18n'

const GROUPS = ['cartesian', 'polar', 'noaxes'] as const
const bus = useD3PBus()
const id = ref(GALLERY[0].id)
const build = (key: string) => GALLERY.find((g) => g.id === key)!.build(bus)
// the scene is made of plain classes: no deep reactivity
const scene = shallowRef<GalleryScene>(build(id.value))
watch(id, (key) => {
  const old = scene.value
  scene.value = build(key)
  old.destroy()
})
onBeforeUnmount(() => scene.value.destroy())
</script>

<template>
  <div class="toolbar">
    <select v-model="id" class="type-select">
      <optgroup v-for="g in GROUPS" :key="g" :label="t(`group.${g}` as MessageKey)">
        <option v-for="e in GALLERY.filter((x) => x.group === g)" :key="e.id" :value="e.id">{{ t(`type.${e.id}` as MessageKey) }}</option>
      </optgroup>
    </select>
  </div>
  <div class="chart-host">
    <!-- a new chart per scene: each has its own margins -->
    <D3PVChart :key="id" :objects="scene.objects" :margin="scene.margin" />
    <D3PVLegend v-if="scene.legend" :legend="scene.legend" />
    <D3PVTooltip v-if="scene.tooltip" :tooltip="scene.tooltip" />
  </div>
</template>
