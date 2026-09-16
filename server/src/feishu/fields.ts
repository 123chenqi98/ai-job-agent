// 飞书多维表格字段值解析工具：富文本 / 超链接 / 单多选 / 日期

export function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (Array.isArray(value)) {
    return value
      .map((seg) => {
        if (seg === null) return ''
        if (typeof seg === 'string' || typeof seg === 'number') return String(seg)
        const obj = seg as Record<string, unknown>
        return String(obj.text ?? obj.name ?? obj.en_name ?? '').trim()
      })
      .filter(Boolean)
      .join('')
      .trim()
  }
  const obj = value as Record<string, unknown>
  return String(obj.text ?? obj.name ?? '').trim()
}

// 单选 / 多选字段统一为字符串数组（飞书返回可能是字符串或字符串数组）
export function toOptions(value: unknown): string[] {
  if (value === null || value === undefined) return []
  const list = Array.isArray(value) ? value : [value]
  return list
    .map((v) => (typeof v === 'string' ? v.trim() : toText(v)))
    .filter(Boolean)
}

// 日期字段（毫秒时间戳）→ 北京时间 YYYY-MM-DD
export function toDateText(value: unknown): string | null {
  if (typeof value !== 'number' || value <= 0) return null
  const beijing = new Date(value + 8 * 60 * 60 * 1000)
  return beijing.toISOString().slice(0, 10)
}

// 超链接字段（type=15）：{ link, text } 或富文本数组中带 link 的段
// 安全口径：飞书是多人可写的外部数据源，链接会渲染成 <a href>，
// 仅允许 http/https，拦截 javascript:/data: 等存储型 XSS 向量
function safeHttpUrl(raw: unknown): string | null {
  if (!raw) return null
  const text = String(raw).trim()
  if (!text) return null
  try {
    const url = new URL(text, 'http://placeholder.invalid')
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
    return null
  } catch {
    return null
  }
}

export function toUrl(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    for (const seg of value) {
      if (seg && typeof seg === 'object' && 'link' in seg) {
        return safeHttpUrl((seg as Record<string, unknown>).link)
      }
    }
    return null
  }
  if (typeof value === 'object' && 'link' in value) {
    return safeHttpUrl((value as Record<string, unknown>).link)
  }
  return null
}
