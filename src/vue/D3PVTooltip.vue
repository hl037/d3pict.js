<script setup lang="ts">
import { computed, toRaw, type PropType } from 'vue'
import { d3pTooltipText, type D3PTooltip } from '../index'
import { useBusTick } from './shared'

const props = defineProps({ tooltip: { type: Object as PropType<D3PTooltip>, required: true } })
// the prop may be replaced: everything is read from it, never captured
const tooltip = computed(() => toRaw(props.tooltip))
const tick = useBusTick(() => ({ bus: tooltip.value.manager.bus, events: [tooltip.value.manager.e.show, tooltip.value.manager.e.hide, tooltip.value.container.e.changed] }))
const containers = computed(() => {
  void tick.value
  return tooltip.value.container.getContainers().filter((c) => c.data)
})
</script>

<template>
  <Teleport v-for="c in containers" :key="c.chart.id" :to="c.container">
    <slot :data="c.data" :chart="c.chart">
      <!-- a long list goes in columns, so the box does not grow taller than the chart -->
      <div class="d3pict-tooltip" :style="{ background: '#fff', color: '#222', border: '1px solid #ccc', borderRadius: '4px', padding: '4px 8px', font: '12px sans-serif', whiteSpace: 'nowrap', columnCount: Math.ceil(c.data!.series.length / 12), columnGap: '16px' }">
        <div v-for="s in c.data!.series" :key="s.renderer.id" style="break-inside: avoid">
          <span :style="{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: s.color, marginRight: '4px' }" />
          {{ d3pTooltipText(s) }}
        </div>
      </div>
    </slot>
  </Teleport>
</template>
