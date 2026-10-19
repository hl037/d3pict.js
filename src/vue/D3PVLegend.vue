<script setup lang="ts">
import { computed, toRaw, type PropType } from 'vue'
import type { D3PLegendBundle } from '../index'
import { useBusTick } from './shared'

const props = defineProps({
  legend: { type: Object as PropType<D3PLegendBundle>, required: true },
  /** CSS position of the legend box inside the chart svg area (it may sit in the margins). */
  style: { type: Object as PropType<Record<string, string>>, default: () => ({ position: 'absolute', top: '4px', right: '4px', maxHeight: 'calc(100% - 8px)', overflowY: 'auto' }) },
})
// the prop may be replaced: everything is read from it, never captured
const legend = computed(() => toRaw(props.legend))
const tick = useBusTick(() => ({ bus: legend.value.manager.bus, events: [legend.value.manager.e.changed, legend.value.container.e.changed] }))
const containers = computed(() => {
  void tick.value
  return legend.value.container.getContainers()
})
</script>

<template>
  <Teleport v-for="c in containers" :key="c.chart.id" :to="c.container">
    <slot :data="c.data" :chart="c.chart">
      <div v-if="c.data" :style="{ ...props.style, pointerEvents: 'auto', font: '12px sans-serif' }">
        <div
          v-for="s in c.data.series"
          :key="`${s.renderer.id}-${s.key}`"
          :style="{ cursor: 'pointer', opacity: s.visible ? '1' : '0.4' }"
          @click="s.toggle()"
        >
          <span :style="{ display: 'inline-block', width: '10px', height: '10px', background: s.color, marginRight: '4px' }" />
          {{ s.label }}
        </div>
      </div>
    </slot>
  </Teleport>
</template>
