import { describe, expect, it } from 'vitest'
import { mergeDiff } from '../examples/snippets/diff'

describe('the diff of two versions of a code', () => {
  it('keeps what stays, marks what is added and what is removed, in reading order', () => {
    const { text, statuses } = mergeDiff('a\nb\nc\nd', 'a\nB\nc\nd\ne')
    expect(text.split('\n')).toEqual(['a', 'b', 'B', 'c', 'd', 'e'])
    expect(statuses).toBe('=-+==+')
  })

  it('has a status for each line, and the new version is what stays plus what is added', () => {
    const before = 'one\ntwo\nthree\nfour\nfive'
    const after = 'one\n2\nthree\nfour\nfive\nsix\nseven'
    const { text, statuses } = mergeDiff(before, after)
    const lines = text.split('\n')
    expect(statuses.length).toBe(lines.length)
    expect(lines.filter((_, i) => statuses[i] !== '-')).toEqual(after.split('\n'))
    expect(lines.filter((_, i) => statuses[i] !== '+')).toEqual(before.split('\n'))
  })

  it('is all unchanged for identical versions, and all added from nothing', () => {
    expect(mergeDiff('x\ny', 'x\ny').statuses).toBe('==')
    expect(mergeDiff('', 'x').statuses).toBe('-+') // the empty line the empty text has
  })
})

describe('the diff and the comments', () => {
  const run = (before: string, after: string) => {
    const { text, statuses } = mergeDiff(before, after)
    return text.split('\n').map((l, i) => `${statuses[i]} ${l}`)
  }

  it('does not show a comment that goes', () => {
    expect(run('// the line\nconst a = 1', 'const a = 1')).toEqual(['= const a = 1'])
  })

  it('shows a reworded comment once, as it is now, unmarked', () => {
    expect(run('// old words\nconst a = 1', '// new words\nconst a = 1')).toEqual(['= // new words', '= const a = 1'])
  })

  it('marks a new comment as added, and still shows the code that changes', () => {
    expect(run('const a = 1\nconst b = 2', '// the second one\nconst a = 1\nconst b = 3')).toEqual(['+ // the second one', '= const a = 1', '- const b = 2', '+ const b = 3'])
  })

  it('knows the comments of the languages of the snippets', () => {
    expect(run('<!-- old -->\n<div />', '<!-- new -->\n<div />')).toEqual(['= <!-- new -->', '= <div />'])
    expect(run('{/* old */}\n<div />', '{/* new */}\n<div />')).toEqual(['= {/* new */}', '= <div />'])
  })
})

describe('a comment on code that changes', () => {
  it('is marked as added even when another comment went', () => {
    const { text, statuses } = mergeDiff('// the second axis\nconst a = 1\nconst b = 2', '// the same domains, polar\nconst a = 5\nconst b = 2')
    expect(text.split('\n').map((l, i) => `${statuses[i]} ${l}`)).toEqual(['- const a = 1', '+ // the same domains, polar', '+ const a = 5', '= const b = 2'])
  })

  it('is shown unmarked when it only rewords the comment of a line that stays', () => {
    const { text, statuses } = mergeDiff('// old words\nconst a = 1\nconst b = 2', '// new words\nconst a = 1\nconst b = 3')
    expect(text.split('\n').map((l, i) => `${statuses[i]} ${l}`)).toEqual(['= // new words', '= const a = 1', '- const b = 2', '+ const b = 3'])
  })
})
