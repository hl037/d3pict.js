import { afterEach, describe, expect, it } from 'vitest'
import { messages, setLocale, t, toLocale, type MessageKey } from '../examples/shared/i18n'
import { toolButtons } from '../examples/scenarios/tools'

afterEach(() => setLocale('en'))

describe('examples i18n', () => {
  it('defaults to English and maps language tags', () => {
    expect(toLocale(undefined)).toBe('en')
    expect(toLocale('de-DE')).toBe('en')
    expect(toLocale('fr')).toBe('fr')
    expect(toLocale('fr-FR')).toBe('fr')
    expect(t('reset')).toBe('Reset')
  })

  it('has the same keys in every language, all non-empty', () => {
    expect(Object.keys(messages.fr).sort()).toEqual(Object.keys(messages.en).sort())
    for (const lang of ['en', 'fr'] as const) for (const v of Object.values(messages[lang])) expect(v.trim()).not.toBe('')
  })

  it('labels the tool buttons in the current locale', () => {
    expect(toolButtons().map((b) => b.label)).toContain('Pan')
    setLocale('fr')
    expect(toolButtons().map((b) => b.label)).toContain('Déplacer')
    expect(t('example.lines.title' as MessageKey)).toBe('Lignes et aires')
  })
})
