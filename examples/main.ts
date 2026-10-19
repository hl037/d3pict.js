import { examples, type Framework } from './registry'
import { setLocale, t, toLocale, type Locale, type MessageKey } from './shared/i18n'
import './style.css'

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'vue', label: 'Vue' },
  { id: 'react', label: 'React' },
]

// English unless `?lang=fr`
const locale: Locale = toLocale(new URLSearchParams(location.search).get('lang'))
setLocale(locale)
document.documentElement.lang = locale

const nav = document.getElementById('nav')!
const title = document.getElementById('title')!
const desc = document.getElementById('desc')!
const stage = document.getElementById('stage')!
const langs = document.getElementById('langs')!

let dispose: (() => void) | undefined
let token = 0

/** `#/<example>/<framework>` */
function parse() {
  const [, id, fw] = location.hash.split('/')
  const example = examples.find((e) => e.id === id) ?? examples[0]
  const framework = (FRAMEWORKS.find((f) => f.id === fw)?.id ?? 'core') as Framework
  return { example, framework }
}

async function show() {
  const { example, framework } = parse()
  const mine = ++token
  dispose?.()
  dispose = undefined
  stage.replaceChildren()

  nav.replaceChildren(
    ...examples.filter((e) => !e.hidden).map((e) => {
      const group = document.createElement('div')
      group.className = 'group'
      group.append(Object.assign(document.createElement('h3'), { textContent: t(`example.${e.id}.title` as MessageKey) }))
      for (const f of FRAMEWORKS) {
        const a = Object.assign(document.createElement('a'), { href: `#/${e.id}/${f.id}`, textContent: f.label })
        if (e === example && f.id === framework) a.className = 'active'
        group.append(a)
      }
      return group
    }),
  )
  title.textContent = `${t(`example.${example.id}.title` as MessageKey)} — ${FRAMEWORKS.find((f) => f.id === framework)!.label}`
  desc.textContent = t(`example.${example.id}.description` as MessageKey)

  langs.replaceChildren(
    ...(['en', 'fr'] as const).map((l) => {
      const url = new URL(location.href)
      url.searchParams.set('lang', l)
      return Object.assign(document.createElement('a'), { href: url.href, textContent: l.toUpperCase(), className: l === locale ? 'active' : '' })
    }),
  )

  const mount = await example.load[framework]()
  if (mine !== token) return // navigated away while loading
  dispose = mount(stage)
}

window.addEventListener('hashchange', show)
void show()
