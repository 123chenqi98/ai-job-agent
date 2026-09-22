// 将飞书表格单元格中拼接的岗位串拆分为单个岗位列表。
// 需要括号感知：「算法工程师（金融智能体、风控营销）」不能被内部的顿号拆开。

const OPEN_PARENS = new Set(['（', '(', '【', '['])
const CLOSE_PARENS = new Set(['）', ')', '】', ']'])
const SEPARATORS = new Set(['、', '，', ',', '；', ';', '\n', '\r'])

export function splitJobTitles(raw: string): string[] {
  if (!raw) return []
  const result: string[] = []
  let depth = 0
  let buf = ''

  for (const ch of raw) {
    if (OPEN_PARENS.has(ch)) {
      depth++
      buf += ch
    } else if (CLOSE_PARENS.has(ch)) {
      depth = Math.max(0, depth - 1)
      buf += ch
    } else if (depth === 0 && SEPARATORS.has(ch)) {
      const piece = buf.trim()
      if (piece) result.push(piece)
      buf = ''
    } else {
      buf += ch
    }
  }
  const tail = buf.trim()
  if (tail) result.push(tail)

  // 去重（保留首次出现顺序）
  return [...new Set(result)]
}
