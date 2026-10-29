/**
 * The web fonts of a chart, ready to go into an exported SVG. A file that is drawn on its own (an SVG
 * opened in a viewer, or loaded as an image to make a PNG) does not see the fonts of the page: its text
 * falls back to a font that looks like the one you chose. Writing the `@font-face` of the fonts the chart
 * uses into the file, with the font files inlined as `data:` URLs, keeps the text as it is on screen.
 *
 * The rules are read from the style sheets of the page. A sheet from another origin that does not allow
 * it (no CORS headers) cannot be read, and its fonts are left out; so are fonts loaded by script
 * (`new FontFace(...)`), whose files cannot be read back.
 */

interface PageFontFace {
  family: string
  style: string
  weightMin: number
  weightMax: number
  /** The code points the file covers (`unicode-range`), or `undefined` for all of them. */
  ranges: [number, number][] | undefined
  /** The files, the most compact format first. */
  sources: { url: string; format: string }[]
  /** What the rule says, to write it back. */
  stretch: string
  display: string
}

const FORMAT_ORDER = ['woff2', 'woff', 'truetype', 'opentype', '']
const MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', truetype: 'font/ttf', opentype: 'font/otf' }

const unquote = (family: string) => family.trim().replace(/^["']|["']$/g, '').toLowerCase()

function weightRange(value: string): [number, number] {
  const numbers = value
    .trim()
    .split(/\s+/)
    .map((word) => (word === 'normal' ? 400 : word === 'bold' ? 700 : Number(word)))
    .filter((n) => Number.isFinite(n))
  if (!numbers.length) return [400, 400]
  return [Math.min(...numbers), Math.max(...numbers)]
}

/** `U+0000-00FF, U+0131, U+4??` as ranges of code points. */
function unicodeRanges(value: string): [number, number][] | undefined {
  if (!value.trim()) return undefined
  const ranges: [number, number][] = []
  for (const part of value.split(',')) {
    const match = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i)
    if (!match) continue
    if (match[1].includes('?')) ranges.push([parseInt(match[1].replaceAll('?', '0'), 16), parseInt(match[1].replaceAll('?', 'F'), 16)])
    else ranges.push([parseInt(match[1], 16), parseInt(match[2] ?? match[1], 16)])
  }
  return ranges.length ? ranges : undefined
}

function sourcesOf(src: string, base: string): PageFontFace['sources'] {
  const sources: PageFontFace['sources'] = []
  for (const match of src.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)(?:\s*format\(\s*["']?([\w-]+)["']?\s*\))?/g)) {
    const raw = match[1] ?? match[2] ?? match[3]
    try {
      sources.push({ url: new URL(raw, base).href, format: (match[4] ?? '').toLowerCase() })
    } catch {
      /* not a URL */
    }
  }
  return sources.sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format))
}

/** The `@font-face` rules of the style sheets of the page, in the ones that can be read. */
function pageFontFaces(): PageFontFace[] {
  const faces: PageFontFace[] = []
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      if (rule.type === 5 /* CSSRule.FONT_FACE_RULE */) {
        const style = (rule as CSSFontFaceRule).style
        const family = unquote(style.getPropertyValue('font-family'))
        const sources = sourcesOf(style.getPropertyValue('src'), base)
        if (!family || !sources.length) continue
        const [weightMin, weightMax] = weightRange(style.getPropertyValue('font-weight'))
        faces.push({
          family,
          style: style.getPropertyValue('font-style').trim() || 'normal',
          weightMin,
          weightMax,
          ranges: unicodeRanges(style.getPropertyValue('unicode-range')),
          sources,
          stretch: style.getPropertyValue('font-stretch').trim(),
          display: style.getPropertyValue('font-display').trim(),
        })
      } else if ('styleSheet' in rule && (rule as CSSImportRule).styleSheet) {
        const sheet = (rule as CSSImportRule).styleSheet!
        try {
          visit(sheet.cssRules, sheet.href ?? base)
        } catch {
          /* an imported sheet of another origin */
        }
      } else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules, base)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules, sheet.href ?? document.baseURI)
    } catch {
      /* a sheet of another origin that does not allow to be read */
    }
  }
  return faces
}

/** What the text of `root` is written with: for each family, the weights and styles in use. */
function fontsInUse(root: Element): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>()
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    // only what writes something: the rest only inherits a font
    if (![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim())) continue
    const computed = getComputedStyle(element)
    const style = computed.fontStyle === 'oblique' ? 'italic' : computed.fontStyle || 'normal'
    const variant = `${Number(computed.fontWeight) || weightRange(computed.fontWeight)[0]}|${style}`
    for (const family of computed.fontFamily.split(',')) {
      const name = unquote(family)
      if (!name) continue
      if (!used.has(name)) used.set(name, new Set())
      used.get(name)!.add(variant)
    }
  }
  return used
}

/** The rules that give the weights and styles in use for a family, and cover the characters of the text. */
function neededFaces(faces: PageFontFace[], used: Map<string, Set<string>>, text: string): PageFontFace[] {
  const codes = new Set<number>()
  for (const char of text) codes.add(char.codePointAt(0)!)
  const covers = (face: PageFontFace) => !face.ranges || [...codes].some((code) => face.ranges!.some(([from, to]) => code >= from && code <= to))
  const chosen = new Set<PageFontFace>()
  for (const [family, variants] of used) {
    const ofFamily = faces.filter((face) => face.family === family)
    for (const variant of variants) {
      const [weightText, style] = variant.split('|')
      const weight = Number(weightText)
      const sameStyle = ofFamily.filter((face) => face.style === style)
      const candidates = sameStyle.length ? sameStyle : ofFamily
      // the rule whose weights are the closest to the one in use: all the subsets of it are needed
      const distance = (face: PageFontFace) => (weight < face.weightMin ? face.weightMin - weight : weight > face.weightMax ? weight - face.weightMax : 0)
      const best = Math.min(...candidates.map(distance))
      for (const face of candidates) {
        const closest = candidates.find((other) => distance(other) === best)!
        if (distance(face) === best && face.weightMin === closest.weightMin && face.weightMax === closest.weightMax && face.style === closest.style && covers(face)) chosen.add(face)
      }
    }
  }
  return [...chosen]
}

const files = new Map<string, Promise<string | undefined>>()

/** The font file as a `data:` URL (fetched once), or `undefined` when it cannot be read. */
function fontData(source: { url: string; format: string }): Promise<string | undefined> {
  if (source.url.startsWith('data:')) return Promise.resolve(source.url)
  let file = files.get(source.url)
  if (!file) {
    file = (async () => {
      try {
        const response = await fetch(source.url)
        if (!response.ok) return undefined
        const bytes = new Uint8Array(await response.arrayBuffer())
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        const mime = MIME[source.format] ?? (response.headers.get('content-type') || 'font/woff2')
        return `data:${mime};base64,${btoa(binary)}`
      } catch {
        return undefined // another origin that does not allow it, or no network
      }
    })()
    files.set(source.url, file)
  }
  return file
}

/**
 * The `@font-face` rules (as CSS text) of the web fonts the text of `root` is written with, whose font files
 * are inlined. `text` is the text of the chart: a rule of a subset of a font (`unicode-range`) is only
 * written when one of its characters is there. An empty string when the chart uses no web font.
 */
export async function d3pFontFaceCss(root: Element, text: string): Promise<string> {
  const used = fontsInUse(root)
  if (!used.size) return ''
  const faces = neededFaces(pageFontFaces(), used, text)
  const rules = await Promise.all(
    faces.map(async (face) => {
      // the first file that can be read (the formats come most compact first)
      let source: { data: string; format: string } | undefined
      for (const candidate of face.sources) {
        const data = await fontData(candidate)
        if (data) {
          source = { data, format: candidate.format }
          break
        }
      }
      if (!source) return ''
      const weight = face.weightMin === face.weightMax ? `${face.weightMin}` : `${face.weightMin} ${face.weightMax}`
      return [
        '@font-face {',
        `font-family: "${face.family}";`,
        `src: url("${source.data}")${source.format ? ` format("${source.format}")` : ''};`,
        `font-weight: ${weight};`,
        `font-style: ${face.style};`,
        face.stretch ? `font-stretch: ${face.stretch};` : '',
        face.ranges ? `unicode-range: ${face.ranges.map(([from, to]) => (from === to ? `U+${from.toString(16)}` : `U+${from.toString(16)}-${to.toString(16)}`)).join(', ')};` : '',
        '}',
      ]
        .filter(Boolean)
        .join(' ')
    }),
  )
  return rules.filter(Boolean).join('\n')
}
