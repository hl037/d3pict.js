<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * A code block that shows what changed since the step before: the lines that stay are dimmed,
 * the added and removed ones are marked like in a diff, and what is further than `context` lines
 * from a change is folded (a click opens it). `statuses` has a character per line of the block:
 * `=` stays, `+` added, `-` removed.
 */
const props = withDefaults(defineProps<{ statuses: string; context?: number; label: (hidden: number) => string }>(), { context: 3 })
const root = ref<HTMLElement>()

onMounted(() => {
  const lines = [...(root.value?.querySelectorAll<HTMLElement>('pre code .line') ?? [])]
  // the markup is not the one expected: leave the code as it is
  if (lines.length !== props.statuses.length) return
  const changed = [...props.statuses].some((c) => c !== '=')
  if (!changed) return
  root.value!.querySelector('pre')!.classList.add('has-diff')
  const shown = new Set<number>()
  lines.forEach((line, i) => {
    const status = props.statuses[i]
    if (status === '=') return
    line.classList.add('diff', status === '+' ? 'add' : 'remove')
    for (let k = i - props.context; k <= i + props.context; k++) shown.add(k)
  })
  // the others are folded, in runs
  let run: HTMLElement[] = []
  const fold = () => {
    if (!run.length) return
    const hidden = run
    run = []
    hidden.forEach((l) => (l.style.display = 'none'))
    const button = document.createElement('div')
    button.className = 'diff-fold'
    button.textContent = `▸ ${props.label(hidden.length)}`
    button.onclick = () => {
      hidden.forEach((l) => (l.style.display = ''))
      button.remove()
    }
    hidden[0].before(button)
  }
  lines.forEach((line, i) => (shown.has(i) ? fold() : run.push(line)))
  fold()
})
</script>

<template>
  <div ref="root" class="diff-code"><slot /></div>
</template>
