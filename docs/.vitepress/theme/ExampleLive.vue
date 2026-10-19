<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { setLocale, toLocale } from '../../../examples/shared/i18n'
import type { Framework } from '../../../examples/registry'
import DiffCode from './DiffCode.vue'
import { framework, useSavedFramework, withData } from './framework'

const { lang } = useData()
const props = defineProps<{ id: string; height?: number; diffs?: Record<string, string> }>()

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'vue', label: 'Vue' },
  { id: 'react', label: 'React' },
]

const text = computed(() =>
  lang.value.startsWith('fr')
    ? { data: 'Inclure les générateurs de données', hidden: (n: number) => `${n} ligne${n > 1 ? 's' : ''} inchangée${n > 1 ? 's' : ''}` }
    : { data: 'Include the data generators', hidden: (n: number) => `${n} unchanged line${n > 1 ? 's' : ''}` },
)
const slotName = computed(() => `${framework.value}-${withData.value ? 'data' : 'nodata'}`)
const stage = ref<HTMLElement>()
const error = ref('')
let dispose: (() => void) | undefined
let token = 0

/** Mount the example in the stage. Everything is loaded on the client: the charts need a DOM. */
async function show() {
  const mine = ++token
  dispose?.()
  dispose = undefined
  stage.value?.replaceChildren()
  error.value = ''
  try {
    setLocale(toLocale(lang.value)) // the examples' own text follows the page language
    const { examples } = await import('../../../examples/registry')
    const example = examples.find((e) => e.id === props.id)
    if (!example) throw new Error(`exemple inconnu : ${props.id}`)
    const mount = await example.load[framework.value]()
    if (mine !== token || !stage.value) return // changed tab while loading
    dispose = mount(stage.value)
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(() => {
  useSavedFramework() // after mounting: the server render and the first client render both show Core
  void show()
})
watch([framework, lang], show)
onBeforeUnmount(() => {
  token++
  dispose?.()
})
</script>

<template>
  <div class="example-live">
    <div class="tabs" role="tablist">
      <button v-for="f in FRAMEWORKS" :key="f.id" role="tab" :aria-selected="framework === f.id" :class="{ active: framework === f.id }" @click="framework = f.id">
        {{ f.label }}
      </button>
    </div>
    <div ref="stage" class="stage" :style="{ height: `${height ?? 460}px` }" />
    <p v-if="error" class="error">{{ error }}</p>
    <!-- a step of the guide: the code, with what changed since the step before -->
    <div v-if="$slots[`${framework}-diff`]" class="source">
      <DiffCode :key="framework" :statuses="diffs?.[framework] ?? ''" :label="text.hidden"><slot :name="`${framework}-diff`" /></DiffCode>
    </div>
    <!-- the code of the example, for the framework selected above, to copy as it is -->
    <div v-else-if="$slots[slotName]" class="source">
      <div class="bar">
        <label><input v-model="withData" type="checkbox" /> {{ text.data }}</label>
      </div>
      <slot :name="slotName" />
    </div>
  </div>
</template>

<style scoped>
.example-live { margin: 16px 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; }
.tabs { display: flex; gap: 2px; padding: 6px 8px 0; background: var(--vp-c-bg-soft); border-bottom: 1px solid var(--vp-c-divider); }
.tabs button { padding: 6px 14px; border: 0; border-radius: 6px 6px 0 0; background: transparent; color: var(--vp-c-text-2); font: inherit; cursor: pointer; }
.tabs button.active { background: var(--vp-c-bg); color: var(--vp-c-brand-1); font-weight: 600; }
.stage { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--vp-c-bg); }
.source { padding: 8px 12px 12px; border-top: 1px solid var(--vp-c-divider); background: var(--vp-c-bg); }
.bar { display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: flex-end; font-size: 13px; color: var(--vp-c-text-2); }
.bar label { cursor: pointer; }
.error { margin: 0; padding: 8px 12px; color: var(--vp-c-danger-1); }
</style>
