<script setup lang="ts">
import { computed, toRaw, type PropType } from 'vue'
import type { D3PSlot } from '../index'
import { useBusTick } from './shared'

const props = defineProps({ slot: { type: Object as PropType<D3PSlot>, required: true } })
// the prop may be replaced: everything is read from it, never captured
const slot = computed(() => toRaw(props.slot))
const tick = useBusTick(() => ({ bus: slot.value.bus, events: [slot.value.e.changed] }))
const containers = computed(() => {
  void tick.value
  return slot.value.getContainers()
})
</script>

<template>
  <!-- the content goes in the element of the slot of each chart; it gets the pointer back, the slot lets it through -->
  <Teleport v-for="c in containers" :key="c.chart.id" :to="c.container">
    <div style="pointer-events: auto; width: 100%; height: 100%"><slot :chart="c.chart" /></div>
  </Teleport>
</template>
