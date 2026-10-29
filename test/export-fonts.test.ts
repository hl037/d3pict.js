// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { D3PAxis, D3PAxisDomain, D3PBus, D3PChart, d3pSettle } from '../src'
import { d3pFontFaceCss } from '../src/core/export-fonts'

/**
 * The style sheets of the page, as a browser gives them. (jsdom drops the `src` of a `@font-face` it parses, so the
 * rules are made here: the declarations are what `style.getPropertyValue` returns in a browser.)
 */
interface FaceRule {
  family: string
  weight?: string
  style?: string
  range?: string
  src?: string
}
let sheets: { href: string | null; cssRules: unknown }[]
const fontFace = (rule: FaceRule) => {
  const declarations: Record<string, string> = {
    'font-family': `"${rule.family}"`,
    src: rule.src ?? 'url("data:font/woff2;base64,AAAA") format("woff2")',
    'font-weight': rule.weight ?? '400',
    'font-style': rule.style ?? 'normal',
    'unicode-range': rule.range ?? '',
  }
  return { type: 5, style: { getPropertyValue: (name: string) => declarations[name] ?? '' } }
}
const rules = (...faces: FaceRule[]) => {
  const sheet = { href: null as string | null, cssRules: faces.map(fontFace) }
  sheets.push(sheet)
  return sheet
}
const withSrc = (family: string, url: string, extra: Partial<FaceRule> = {}): FaceRule => ({ family, src: `url("${url}") format("woff2")`, ...extra })

/** A piece of text written with a font: what the exporter reads to know the fonts in use. */
const text = (family: string, content: string, extra = '') => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  t.setAttribute('style', `font-family: ${family}; ${extra}`)
  t.textContent = content
  svg.append(t)
  document.body.append(svg)
  return svg
}

beforeEach(() => {
  sheets = []
  Object.defineProperty(document, 'styleSheets', { get: () => sheets, configurable: true })
})
afterEach(() => {
  delete (document as { styleSheets?: unknown }).styleSheets
  document.body.innerHTML = ''
})

describe('the web fonts of a chart', () => {
  it('writes the rule of the font the text uses, with the file inlined', async () => {
    rules({ family: 'Plain Sans' })
    const css = await d3pFontFaceCss(text('"Plain Sans", sans-serif', 'Hello'), 'Hello')
    expect(css).toContain('font-family: "plain sans"')
    expect(css).toContain('src: url("data:font/woff2;base64,AAAA") format("woff2")')
    expect(css).toContain('font-weight: 400')
  })

  it('is empty when the text only uses fonts of the machine', async () => {
    rules({ family: 'Plain Sans' })
    expect(await d3pFontFaceCss(text('sans-serif', 'Hello'), 'Hello')).toBe('')
    expect(await d3pFontFaceCss(text('Georgia, serif', 'Hello'), 'Hello')).toBe('')
  })

  it('leaves out the fonts that are not used, the weights that are not used and the subsets of characters that are not there', async () => {
    rules(
      withSrc('Family A', 'data:font/woff2;base64,A400LATIN', { weight: '400', range: 'U+0000-00FF' }),
      withSrc('Family A', 'data:font/woff2;base64,A700LATIN', { weight: '700', range: 'U+0000-00FF' }),
      withSrc('Family A', 'data:font/woff2;base64,A700CYRILLIC', { weight: '700', range: 'U+0400-045F' }),
      withSrc('Family B', 'data:font/woff2;base64,B700', { weight: '700' }),
    )
    const css = await d3pFontFaceCss(text('"Family A"', 'Hello', 'font-weight: 700'), 'Hello')
    expect(css).toContain('A700LATIN')
    expect(css).not.toContain('A400LATIN') // another weight
    expect(css).not.toContain('A700CYRILLIC') // no cyrillic character in the text
    expect(css).not.toContain('B700') // another family
    // with a cyrillic character, the subset is needed too
    const both = await d3pFontFaceCss(text('"Family A"', 'Hello Привет', 'font-weight: 700'), 'Hello Привет')
    expect(both).toContain('A700LATIN')
    expect(both).toContain('A700CYRILLIC')
  })

  it('reads the ranges of code points: a single one, a span and a wildcard', async () => {
    rules(
      withSrc('Ranged', 'data:font/woff2;base64,SINGLE', { range: 'U+0131' }),
      withSrc('Ranged', 'data:font/woff2;base64,SPAN', { range: 'U+0152-0153, U+02BB-02BC' }),
      withSrc('Ranged', 'data:font/woff2;base64,WILD', { range: 'U+4??' }),
    )
    const only = async (chars: string) => d3pFontFaceCss(text('Ranged', chars), chars)
    expect(await only('ı')).toContain('SINGLE') // U+0131
    expect(await only('ı')).not.toContain('SPAN')
    expect(await only('œ')).toContain('SPAN') // U+0153
    expect(await only('Ѐ')).toContain('WILD') // U+0400
    expect(await only('Ӏ')).toContain('WILD') // U+04C0
    expect(await only('a')).toBe('') // none of them
  })

  it('takes the rule of the closest weight, and a variable font for the weights it spans', async () => {
    rules(
      withSrc('Closest', 'data:font/woff2;base64,C400', { weight: '400' }),
      withSrc('Closest', 'data:font/woff2;base64,C700', { weight: '700' }),
      withSrc('Variable', 'data:font/woff2;base64,VARIABLE', { weight: '100 900' }),
    )
    expect(await d3pFontFaceCss(text('Closest', 'Hello', 'font-weight: 600'), 'Hello')).toContain('C700')
    expect(await d3pFontFaceCss(text('Closest', 'Hello', 'font-weight: 500'), 'Hello')).toContain('C400')
    const variable = await d3pFontFaceCss(text('Variable', 'Hello', 'font-weight: 600'), 'Hello')
    expect(variable).toContain('VARIABLE')
    expect(variable).toContain('font-weight: 100 900')
  })

  it('takes the italic rule for an italic text', async () => {
    rules(withSrc('Slanted', 'data:font/woff2;base64,UPRIGHT', { style: 'normal' }), withSrc('Slanted', 'data:font/woff2;base64,ITALIC', { style: 'italic' }))
    const css = await d3pFontFaceCss(text('Slanted', 'Hello', 'font-style: italic'), 'Hello')
    expect(css).toContain('ITALIC')
    expect(css).not.toContain('UPRIGHT')
  })

  describe('with files to fetch', () => {
    const real = globalThis.fetch
    let fetched: string[]
    let reply: (url: string) => Response
    beforeEach(() => {
      fetched = []
      reply = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      globalThis.fetch = (async (url: string) => (fetched.push(String(url)), reply(String(url)))) as never
    })
    afterEach(() => (globalThis.fetch = real))

    it('fetches the file and inlines it as base64, in the format it says', async () => {
      rules(withSrc('Remote One', 'https://fonts.example/one.woff2'))
      const css = await d3pFontFaceCss(text('Remote One', 'Hello'), 'Hello')
      expect(fetched).toEqual(['https://fonts.example/one.woff2'])
      expect(css).toContain('url("data:font/woff2;base64,AQID")')
    })

    it('fetches a file once, whatever the number of exports', async () => {
      rules(withSrc('Remote Two', 'https://fonts.example/two.woff2'))
      await d3pFontFaceCss(text('Remote Two', 'Hello'), 'Hello')
      await d3pFontFaceCss(text('Remote Two', 'Hello'), 'Hello')
      expect(fetched).toEqual(['https://fonts.example/two.woff2'])
    })

    it('prefers a compact format, and resolves the URL against the style sheet', async () => {
      const sheet = rules({ family: 'Formats', src: 'url("fonts/f.ttf") format("truetype"), url("fonts/f.woff2") format("woff2")' })
      sheet.href = 'https://site.example/css/style.css'
      await d3pFontFaceCss(text('Formats', 'Hello'), 'Hello')
      expect(fetched).toEqual(['https://site.example/css/fonts/f.woff2'])
    })

    it('leaves out a font whose file cannot be read, and goes on with the others', async () => {
      rules(withSrc('Blocked', 'https://fonts.example/blocked.woff2'), withSrc('Allowed', 'https://fonts.example/allowed.woff2'))
      reply = (url) => {
        if (url.includes('blocked')) throw new TypeError('Failed to fetch') // no CORS headers
        return new Response(new Uint8Array([9]), { status: 200 })
      }
      const root = text('Blocked', 'Hello')
      root.append(text('Allowed', 'Hello').firstChild!)
      const css = await d3pFontFaceCss(root, 'Hello')
      expect(css).not.toContain('blocked')
      expect(css).toContain('allowed')
      reply = () => new Response('', { status: 404 })
      rules(withSrc('Missing', 'https://fonts.example/missing.woff2'))
      expect(await d3pFontFaceCss(text('Missing', 'Hello'), 'Hello')).toBe('')
    })

    it('tries the next file when the first one cannot be read', async () => {
      rules({ family: 'Fallback', src: 'url("https://fonts.example/a.woff2") format("woff2"), url("https://fonts.example/a.woff") format("woff")' })
      reply = (url) => (url.endsWith('.woff2') ? new Response('', { status: 404 }) : new Response(new Uint8Array([7]), { status: 200 }))
      const css = await d3pFontFaceCss(text('Fallback', 'Hello'), 'Hello')
      expect(fetched).toEqual(['https://fonts.example/a.woff2', 'https://fonts.example/a.woff'])
      expect(css).toContain('format("woff")')
      expect(css).toContain('data:font/woff;base64,Bw==')
    })
  })

  it('does not fail on a style sheet it cannot read, and reads the other ones', async () => {
    sheets.push({
      href: 'https://other.example/style.css',
      get cssRules(): unknown {
        throw new DOMException('Cannot access rules', 'SecurityError') // a sheet of another origin that does not allow it
      },
    })
    rules({ family: 'Readable' })
    expect(await d3pFontFaceCss(text('Readable', 'Hello'), 'Hello')).toContain('"readable"')
  })

  it('reads the rules of imported sheets and of groups (@media, @supports)', async () => {
    sheets.push({ href: null, cssRules: [{ type: 3, styleSheet: { href: 'https://site.example/imported.css', cssRules: [fontFace({ family: 'Imported' })] } }, { type: 4, cssRules: [fontFace({ family: 'Grouped' })] }] })
    expect(await d3pFontFaceCss(text('Imported', 'Hello'), 'Hello')).toContain('"imported"')
    expect(await d3pFontFaceCss(text('Grouped', 'Hello'), 'Hello')).toContain('"grouped"')
  })
})

describe('the fonts in an export', () => {
  async function chartWithFont(family = '"Chart Font"') {
    const bus = new D3PBus()
    const el = document.createElement('div')
    document.body.append(el)
    const chart = new D3PChart({ container: el, width: 400, height: 300, bus })
    new D3PAxis({ bus, name: 'x', domain: new D3PAxisDomain({ bus, domain: [0, 10] }) }).addToChart(chart)
    await d3pSettle(bus)
    // the text of the chart, written with a web font
    chart.getSvg().querySelectorAll('text').forEach((t) => ((t as SVGTextElement).style.fontFamily = family))
    return chart
  }

  it('writes the fonts of the chart in the file, unless it is told not to', async () => {
    rules(withSrc('Chart Font', 'data:font/woff2;base64,EMBEDDED'))
    const chart = await chartWithFont()
    const withFonts = await chart.exportSVG()
    expect(withFonts).toContain('<style>')
    expect(withFonts).toContain('@font-face')
    expect(withFonts).toContain('EMBEDDED')
    expect(await chart.exportSVG({ fonts: false })).not.toContain('@font-face')
  })

  it('puts them where the text of the file can use them: in the svg, before what is drawn', async () => {
    rules(withSrc('Chart Font', 'data:font/woff2;base64,EMBEDDED'))
    const chart = await chartWithFont()
    const doc = new DOMParser().parseFromString(await chart.exportSVG({ background: null }), 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.documentElement.children[0].tagName).toBe('style')
    expect(doc.documentElement.children[0].textContent).toContain('"chart font"')
  })

  it('has no style at all for a chart with no web font', async () => {
    rules(withSrc('Chart Font', 'data:font/woff2;base64,EMBEDDED'))
    const chart = await chartWithFont('sans-serif')
    expect(await chart.exportSVG()).not.toContain('<style')
  })

  it('does not wait for a font it cannot get: the chart is exported without it', async () => {
    const real = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as never
    try {
      rules(withSrc('Chart Font', 'https://fonts.example/unreachable.woff2'))
      const chart = await chartWithFont()
      const svg = await chart.exportSVG()
      expect(svg).not.toContain('@font-face')
      expect(svg).toContain('<svg')
    } finally {
      globalThis.fetch = real
    }
  })

  it('says in the file which font the text of the page uses, since the file is read without the page', async () => {
    rules(withSrc('Page Font', 'data:font/woff2;base64,PAGE'))
    const chart = await chartWithFont('"Page Font"')
    chart.getSvg().style.fontFamily = '"Page Font", sans-serif'
    chart.getSvg().style.fontSize = '14px'
    const root = new DOMParser().parseFromString(await chart.exportSVG(), 'image/svg+xml').documentElement
    const style = root.getAttribute('style')!
    expect(style).toContain('font-family: "Page Font", sans-serif')
    expect(style).toContain('font-size: 14px')
    expect(style).toMatch(/^color: #000/)
  })
})
