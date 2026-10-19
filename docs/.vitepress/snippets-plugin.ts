import { join } from 'node:path'
import type { Plugin } from 'vite'
import { composeSnippet, type SnippetFramework } from '../../examples/snippets/compose'
import { mergeDiff } from '../../examples/snippets/diff'
import { SNIPPETS } from '../../examples/snippets/manifest'

const FRAMEWORKS: SnippetFramework[] = ['core', 'vue', 'react']

/**
 * Turns `<ExampleLive id="lines" />` into the component with its code: for each framework, with
 * and without the data generators, the code of the example assembled from the tagged regions of
 * `examples/` (see `examples/snippets/compose.ts`). They are code blocks of the page, so the site
 * highlights them as any other, and a page only carries its own example. The files are watched:
 * editing an example updates the page.
 */
/**
 * A step of the guide: for each framework the code of the step with what changed since the step
 * before (one text with the lines of both, and a character per line telling which is which).
 */
function guideStep(id: string, n: number, rest: string): string {
  const source = SNIPPETS[id]
  const diffs: Record<string, string> = {}
  const slots = FRAMEWORKS.map((fw) => {
    const { lang, code } = composeSnippet(source, fw, true)
    const before = n > 1 ? composeSnippet(SNIPPETS[`guide-${n - 1}`], fw, true).code : undefined
    const merged = before === undefined ? { text: code.trimEnd(), statuses: '='.repeat(code.trimEnd().split('\n').length) } : mergeDiff(before.trimEnd(), code.trimEnd())
    diffs[fw] = merged.statuses
    return `<template #${fw}-diff>\n\n\`\`\`${lang}\n${merged.text}\n\`\`\`\n\n</template>`
  })
  return `<ExampleLive id="${id}" :diffs='${JSON.stringify(diffs)}'${rest}>\n${slots.join('\n')}\n</ExampleLive>`
}

export function d3pictSnippets(): Plugin {
  return {
    name: 'd3pict-snippets',
    enforce: 'pre',
    transform(code, file) {
      if (!file.endsWith('.md') || !code.includes('<ExampleLive')) return
      return code.replace(/<ExampleLive id="([^"]+)"([^>]*?)\s*\/>/g, (whole, id: string, rest: string) => {
        const source = SNIPPETS[id]
        if (!source) return whole
        for (const f of [source.scenario, 'shared/data.ts', ...Object.values(source.glue ?? {})]) this.addWatchFile(join(process.cwd(), 'examples', f))
        const step = /^guide-(\d+)$/.exec(id)
        if (step) return guideStep(id, Number(step[1]), rest)
        const slots = FRAMEWORKS.flatMap((fw) =>
          [true, false].map((withData) => {
            const { lang, code } = composeSnippet(source, fw, withData)
            return `<template #${fw}-${withData ? 'data' : 'nodata'}>\n\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\`\n\n</template>`
          }),
        )
        return `<ExampleLive id="${id}"${rest}>\n${slots.join('\n')}\n</ExampleLive>`
      })
    },
  }
}
