<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch, type PropType } from 'vue'
import { D3PChart, d3pAutoInteractionArea, d3pMergeArray, type D3PBus, type D3PChartOptions, type D3PMargin } from '../index'
import { busOf, type D3PAttachableLike } from './shared'

const props = defineProps({
  objects: { type: Array as PropType<D3PAttachableLike[]>, default: () => [] },
  width: Number,
  height: Number,
  margin: Object as PropType<Partial<D3PMargin>>,
  name: String,
  resizeDebounceMs: Number,
  bus: Object as PropType<D3PBus>,
})
const emit = defineEmits<{ ready: [chart: D3PChart] }>()

const el = ref<HTMLElement>()
const chart = shallowRef<D3PChart>()
let attached: D3PAttachableLike[] = []
let disposeArea: (() => void) | undefined
const bus = busOf(props.bus && toRaw(props.bus))

const sync = () => {
  const c = chart.value
  if (!c) return
  // objects may come through a deep-reactive array: identity and `this` must be the raw ones
  attached = d3pMergeArray(attached, props.objects.map((o) => toRaw(o)))
    .exit((o) => o.removeFromChart(c))
    .enter((o) => o.addToChart(c))
    .value()
}

onMounted(() => {
  const opts: D3PChartOptions = { container: el.value!, bus, width: props.width, height: props.height, margin: props.margin, name: props.name, resizeDebounceMs: props.resizeDebounceMs }
  const c = new D3PChart(opts)
  chart.value = c
  disposeArea = d3pAutoInteractionArea(c)
  sync()
  emit('ready', c)
})
watch(() => props.objects.map((o) => toRaw(o)), sync, { flush: 'post' })
onBeforeUnmount(() => {
  disposeArea?.()
  chart.value?.destroy()
  chart.value = undefined
  attached = []
})
defineExpose({ chart })
</script>

<template>
  <div ref="el" class="d3pict-chart" :style="{ width: width ? undefined : '100%', height: height ? undefined : '100%' }" />
</template>
