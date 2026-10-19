import { ref, watch } from 'vue'
import type { Framework } from '../../../examples/registry'

const KEY = 'd3pict-framework'
const DATA_KEY = 'd3pict-with-data'
const FRAMEWORKS: Framework[] = ['core', 'vue', 'react']

/**
 * The framework chosen in the examples, shared by every example of every page: choosing one in a
 * tab changes them all, and the choice is remembered. It is the same ref for the whole site.
 */
export const framework = ref<Framework>('core')

/** Whether the code shown includes the functions that generate the series' data. */
export const withData = ref(false)

let started = false

/** Read the saved choice and keep it saved. Client only (called once the page is mounted, so the server render and the first client render agree). */
export function useSavedFramework() {
  if (typeof window === 'undefined' || started) return framework
  started = true
  try {
    const saved = localStorage.getItem(KEY) as Framework | null
    if (saved && FRAMEWORKS.includes(saved)) framework.value = saved
    withData.value = localStorage.getItem(DATA_KEY) === '1'
  } catch {
    /* storage unavailable: the choice only lasts for the visit */
  }
  watch(framework, (value) => {
    try {
      localStorage.setItem(KEY, value)
    } catch {
      /* ignore */
    }
  })
  watch(withData, (value) => {
    try {
      localStorage.setItem(DATA_KEY, value ? '1' : '0')
    } catch {
      /* ignore */
    }
  })
  // another tab of the site chose another one
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue && FRAMEWORKS.includes(e.newValue as Framework)) framework.value = e.newValue as Framework
  })
  return framework
}
