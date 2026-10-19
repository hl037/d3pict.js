<script setup lang="ts">
import { computed, toRaw, type PropType } from 'vue'
import type { D3PAnchor } from '../index'
import { useBusTick } from './shared'

const props = defineProps({
  anchor: { type: Object as PropType<D3PAnchor>, required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: Number,
  height: Number,
  /** Anchor point of the content in [-1, 1]: (-1,-1) top-left, (1,1) bottom-right. */
  point: { type: Object as PropType<{ x: number; y: number }>, default: () => ({ x: -1, y: -1 }) },
})
// the prop may be replaced: everything is read from it, never captured
const anchor = computed(() => toRaw(props.anchor))
const tick = useBusTick(() => ({ bus: anchor.value.bus, events: [anchor.value.e.changed] }))
const containers = computed(() => {
  void tick.value
  return anchor.value.getContainers()
})
const style = computed(() => ({
  position: 'absolute' as const,
  left: `${props.x}px`,
  top: `${props.y}px`,
  width: props.width !== undefined ? `${props.width}px` : undefined,
  height: props.height !== undefined ? `${props.height}px` : undefined,
  transform: `translate(${-(0.5 + props.point.x * 0.5) * 100}%, ${-(0.5 + props.point.y * 0.5) * 100}%)`,
  pointerEvents: 'auto' as const,
}))
</script>

<template>
  <Teleport v-for="c in containers" :key="c.chart.id" :to="c.container">
    <div :style="style"><slot :chart="c.chart" /></div>
  </Teleport>
</template>
