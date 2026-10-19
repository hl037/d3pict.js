/**
 * A line diff between two versions of a piece of code, written as one text that has both: the
 * lines that stay, the lines that are removed and the lines that are added, in the order a reader
 * meets them. `statuses` has a character per line of `text`: `=` it stays, `+` it is added, `-` it is removed.
 */
export interface MergedDiff {
  text: string
  statuses: string
}

/** A line that is only a comment: after `//`, a block comment, `<!--` or `{/*`. */
const isComment = (line: string) => /^\s*(\/\/|\/\*|\*|<!--|\{\/\*)/.test(line)

/**
 * What changes between two steps is the code, not what is said about it: a comment that goes is
 * not shown, and a comment that is reworded is shown once, as it is now. Only a comment that
 * is new is marked as added.
 */
function quietComments(lines: string[], statuses: string): MergedDiff {
  const out: string[] = []
  let kept = ''
  for (let i = 0; i < lines.length; ) {
    if (statuses[i] === '=') {
      out.push(lines[i])
      kept += '='
      i++
      continue
    }
    // a run of changed lines: what goes, then what comes
    let j = i
    while (j < lines.length && statuses[j] !== '=') j++
    const removed = Array.from({ length: j - i }, (_, k) => i + k).filter((k) => statuses[k] === '-')
    let reworded = removed.filter((k) => isComment(lines[k])).length // comments that go, to be matched with new ones
    for (let k = i; k < j; k++) {
      if (statuses[k] === '-' && isComment(lines[k])) continue
      out.push(lines[k])
      // reworded: it comments a line that stays; a comment on a line that changes is new information
      if (statuses[k] === '+' && isComment(lines[k]) && reworded > 0 && statuses[k + 1] === '=') {
        reworded--
        kept += '='
      } else kept += statuses[k]
    }
    i = j
  }
  return { text: out.join('\n'), statuses: kept }
}

export function mergeDiff(before: string, after: string): MergedDiff {
  const a = before.split('\n')
  const b = after.split('\n')
  // longest common subsequence of lines
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const lines: string[] = []
  let statuses = ''
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(a[i])
      statuses += '='
      i++
      j++
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      // what goes is shown before what comes in its place
      lines.push(a[i++])
      statuses += '-'
    } else {
      lines.push(b[j++])
      statuses += '+'
    }
  }
  return quietComments(lines, statuses)
}
