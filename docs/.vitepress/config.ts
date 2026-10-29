import react from '@vitejs/plugin-react'
import { messages } from '../../examples/shared/i18n'
import { d3pictSnippets } from './snippets-plugin'

/** The steps of the guide (page, English title, French title), then the reference pages. */
const GUIDE = [
  ['getting-started', '1. Getting started', '1. Démarrer'],
  ['axes-and-domains', '2. Axes and domains', '2. Axes et domaines'],
  ['series-and-style', '3. Series and style', '3. Séries et style'],
  ['hover', '4. Cursor, tooltip and legend', '4. Curseur, infobulle et légende'],
  ['zoom-and-pan', '5. Zoom and pan', '5. Zoom et déplacement'],
  ['layout', '6. Titles and layout', '6. Titres et mise en page'],
  ['several-axes', '7. Several axes', '7. Plusieurs axes'],
  ['chart-kinds', '8. Other kinds of chart', '8. Autres types de graphique'],
  ['polar', '9. Polar charts', '9. Graphiques polaires'],
  ['changing-data', '10. Change the data', '10. Changer les données'],
  ['export', '11. Export', '11. Export'],
  ['frameworks', '12. Vue and React', '12. Vue et React'],
] as const
const REFERENCE = [
  ['concepts', 'Concepts', 'Concepts'],
  ['advanced', 'Advanced', 'Avancé'],
  ['chart-types', 'Chart types reference', 'Référence des types de graphiques'],
] as const

/** The chart types of the gallery, in the order of their sidebar section. */
const TYPES = ['curves', 'stacked-area', 'percent-area', 'streamgraph', 'stacked-column', 'range-area', 'histogram', 'horizontal-bar', 'lollipop', 'waterfall', 'timeline', 'candlestick', 'boxplot', 'dumbbell', 'bubble', 'heatmap', 'slope', 'annotations', 'radar', 'polar-area', 'radial-bar', 'gauge', 'semi-donut', 'funnel'] as const
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, type DefaultTheme } from 'vitepress'

/** The pages of the API reference, written by TypeDoc (`pnpm docs:api`) before the site is built. */
const API: DefaultTheme.SidebarItem[] = existsSync('docs/api/typedoc-sidebar.json') ? JSON.parse(readFileSync('docs/api/typedoc-sidebar.json', 'utf8')) : []

/** Navigation and sidebar of one language; `prefix` is '' for English and '/fr' for French. */
function nav(prefix: string, lang: 'en' | 'fr', t: { guide: string; reference: string; examples: string; lines: string; tools: string; synced: string; polar: string; polarsync: string; axes: string; titles: string; many: string; data: string; export: string; pie: string; gallery: string; showcase: string; types: string }) {
  const nav: DefaultTheme.NavItem[] = [
    { text: t.guide, link: `${prefix}/guide/getting-started` },
    { text: t.examples, link: `${prefix}/examples/lines` },
    { text: 'API', link: '/api/' },
  ]
  const sidebar: DefaultTheme.SidebarItem[] = [
    { text: t.guide, items: GUIDE.map(([page, en, fr]) => ({ text: lang === 'en' ? en : fr, link: `${prefix}/guide/${page}` })) },
    {
      text: t.reference,
      items: [
        ...REFERENCE.map(([page, en, fr]) => ({ text: lang === 'en' ? en : fr, link: `${prefix}/guide/${page}` })),
        // generated from the source, and in English only
        { text: lang === 'en' ? 'API' : 'API (en anglais)', link: '/api/', collapsed: true, items: API },
      ],
    },
    {
      text: t.examples,
      items: [
        { text: t.showcase, link: `${prefix}/examples/showcase` },
        // one page per chart type, in a section that folds
        { text: t.gallery, link: `${prefix}/examples/gallery`, collapsed: true, items: TYPES.map((id) => ({ text: messages[lang][`type.${id}`], link: `${prefix}/examples/types/${id}` })) },
        { text: t.lines, link: `${prefix}/examples/lines` },
        { text: t.tools, link: `${prefix}/examples/tools` },
        { text: t.axes, link: `${prefix}/examples/axes` },
        { text: t.titles, link: `${prefix}/examples/titles` },
        { text: t.many, link: `${prefix}/examples/many` },
        { text: t.data, link: `${prefix}/examples/data` },
        { text: t.export, link: `${prefix}/examples/export` },
        { text: t.synced, link: `${prefix}/examples/synced` },
        { text: t.polar, link: `${prefix}/examples/polar` },
        { text: t.polarsync, link: `${prefix}/examples/polarsync` },
        { text: t.pie, link: `${prefix}/examples/pie` },
      ],
    },
  ]
  return { nav, sidebar }
}

export default defineConfig({
  base: './',
  title: 'D3Pict',
  cleanUrls: true,
  // the icons of the tab: the SVG where it is supported, the PNG and the ICO elsewhere. The site is built with
  // relative links so that it works under any path: a page reaches the root of the site by going up one level
  // for each folder it is in (`guide/hover` is served as `.../guide/hover`, so its icons are at `../`)
  transformHead({ pageData }) {
    const up = '../'.repeat(Math.max(0, pageData.relativePath.split('/').length - 1)) || './'
    return [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: `${up}favicon.svg` }],
      ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${up}favicon-32.png` }],
      ['link', { rel: 'icon', href: `${up}favicon.ico`, sizes: '32x32' }],
      ['link', { rel: 'apple-touch-icon', href: `${up}apple-touch-icon.png` }],
    ]
  },
  // the logo carries the name, so the title is not written next to it
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: false,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/hl037/d3pict.js', ariaLabel: 'D3Pict on GitHub' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/d3pict', ariaLabel: 'D3Pict on npm' },
    ],
    footer: { message: 'Released under the MIT license.', copyright: 'Copyright © 2026 Léo Flaventin Hauchecorne' },
  },
  // English is the default language (served at the root); French lives under /fr/
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      description: 'Depict your data: SVG charts built from objects, on top of d3. Interactive, animated, and yours to extend.',
      themeConfig: nav('', 'en', { guide: 'Guide', reference: 'Reference', examples: 'Examples', lines: 'Lines and areas', tools: 'Tools', synced: 'Synchronized charts', polar: 'Cartesian and polar', polarsync: 'Cartesian and polar, synchronized', axes: 'Several axes', titles: 'Titles and legend', many: 'Many series', data: 'Adding and removing data', export: 'Export', pie: 'Pie and donut', gallery: 'Chart types', showcase: 'Showcase' }),
    },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      link: '/fr/',
      description: "Dépeignez vos données : des graphiques SVG assemblés à partir d'objets, au-dessus de d3. Interactifs, animés, faits pour être étendus.",
      themeConfig: {
        ...nav('/fr', 'fr', { guide: 'Guide', reference: 'Référence', examples: 'Exemples', lines: 'Lignes et aires', tools: 'Outils', synced: 'Graphiques synchronisés', polar: 'Cartésien et polaire', polarsync: 'Cartésien et polaire, synchronisés', axes: 'Plusieurs axes', titles: 'Titres et légende', many: 'Beaucoup de séries', data: 'Ajouter et retirer des données', export: 'Export', pie: 'Camembert et anneau', gallery: 'Types de graphiques', showcase: 'Vitrine' }),
        footer: { message: 'Publié sous licence MIT.', copyright: 'Copyright © 2026 Léo Flaventin Hauchecorne' },
        socialLinks: [
          { icon: 'github', link: 'https://github.com/hl037/d3pict.js', ariaLabel: 'D3Pict sur GitHub' },
          { icon: 'npm', link: 'https://www.npmjs.com/package/d3pict', ariaLabel: 'D3Pict sur npm' },
        ],
        outline: { label: 'Sur cette page' },
        docFooter: { prev: 'Page précédente', next: 'Page suivante' },
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Retour en haut',
        langMenuLabel: 'Changer de langue',
        darkModeSwitchLabel: 'Apparence',
        lightModeSwitchTitle: 'Passer au thème clair',
        darkModeSwitchTitle: 'Passer au thème sombre',
        skipToContentLabel: 'Aller au contenu',
      },
    },
  },
  // the live examples are TSX (React) and .vue files that live outside of `docs/`
  vite: {
    plugins: [d3pictSnippets(), react()],
    server: { fs: { allow: ['../..'] } },
    // the examples import the library the way an application does
    resolve: {
      alias: [
        { find: /^d3pict\/vue$/, replacement: new URL('../../src/vue/index.ts', import.meta.url).pathname },
        { find: /^d3pict\/react$/, replacement: new URL('../../src/react/index.ts', import.meta.url).pathname },
        { find: /^d3pict$/, replacement: new URL('../../src/index.ts', import.meta.url).pathname },
      ],
    },
  },
})
