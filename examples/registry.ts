import * as guide from './guide'
import { GALLERY } from './scenarios/gallery'

export type Framework = 'core' | 'vue' | 'react'
/** Mounts an example into `root` and returns its cleanup. */
export type ExampleMount = (root: HTMLElement) => () => void

export interface Example {
  id: string
  /** Not listed in the examples application (the documentation shows it on its own page). */
  hidden?: boolean
  /** Frameworks are loaded lazily so a page only pays for the one it shows. */
  load: Record<Framework, () => Promise<ExampleMount>>
}

export const examples: Example[] = [
  {
    id: 'lines',
    load: {
      core: async () => (await import('./core/lines')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Lines.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Lines')).Lines),
    },
  },
  {
    id: 'tools',
    load: {
      core: async () => (await import('./core/tools')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Tools.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Tools')).Tools),
    },
  },
  {
    id: 'synced',
    load: {
      core: async () => (await import('./core/synced')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Synced.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Synced')).Synced),
    },
  },
  {
    id: 'polar',
    load: {
      core: async () => (await import('./core/polar')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Polar.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Polar')).Polar),
    },
  },
  {
    id: 'pie',
    load: {
      core: async () => (await import('./core/pie')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Pie.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Pie')).Pie),
    },
  },
  {
    id: 'axes',
    load: {
      core: async () => (await import('./core/axes')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Axes.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Axes')).Axes),
    },
  },
  {
    id: 'polarsync',
    load: {
      core: async () => (await import('./core/polarsync')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/PolarSync.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/PolarSync')).PolarSync),
    },
  },
  {
    id: 'titles',
    load: {
      core: async () => (await import('./core/titles')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Titles.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Titles')).Titles),
    },
  },
  {
    id: 'many',
    load: {
      core: async () => (await import('./core/many')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Many.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Many')).Many),
    },
  },
  {
    id: 'data',
    load: {
      core: async () => (await import('./core/data')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Data.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Data')).Data),
    },
  },
  {
    id: 'export',
    load: {
      core: async () => (await import('./core/export')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Export.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Export')).ExportExample),
    },
  },
  {
    id: 'showcase',
    load: {
      core: async () => (await import('./core/showcase')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Showcase.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Showcase')).Showcase),
    },
  },
  {
    id: 'gallery',
    load: {
      core: async () => (await import('./core/gallery')).mount,
      vue: async () => (await import('./vue/mount')).vueMount((await import('./vue/Gallery.vue')).default),
      react: async () => (await import('./react/mount')).reactMount((await import('./react/Gallery')).Gallery),
    },
  },
  // one page per chart type in the documentation
  ...GALLERY.map(
    (entry): Example => ({
      id: `type-${entry.id}`,
      hidden: true,
      load: {
        core: async () => (await import('./core/type')).mountType(entry.id),
        vue: async () => {
          const [{ vueMount }, { default: ChartType }, { defineComponent, h }] = await Promise.all([import('./vue/mount'), import('./vue/ChartType.vue'), import('vue')])
          return vueMount(defineComponent({ render: () => h(ChartType, { id: entry.id }) }))
        },
        react: async () => {
          const [{ reactMount }, { ChartType }, { createElement }] = await Promise.all([import('./react/mount'), import('./react/ChartType'), import('react')])
          return reactMount(() => createElement(ChartType, { id: entry.id }))
        },
      },
    }),
  ),
  // the steps of the guide, one chart each
  ...guide.STEPS.map(
    (build, i): Example => ({
      id: `guide-${i + 1}`,
      hidden: true,
      load: {
        core: async () => (await import('./core/scene')).mountScene(build),
        vue: async () => {
          const [{ vueMount }, { default: SceneView }, { defineComponent, h }] = await Promise.all([import('./vue/mount'), import('./vue/SceneView.vue'), import('vue')])
          return vueMount(defineComponent({ render: () => h(SceneView, { build }) }))
        },
        react: async () => {
          const [{ reactMount }, { SceneView }, { createElement }] = await Promise.all([import('./react/mount'), import('./react/SceneView'), import('react')])
          return reactMount(() => createElement(SceneView, { build }))
        },
      },
    }),
  ),
]
