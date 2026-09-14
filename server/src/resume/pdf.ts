import { readFile, stat } from 'node:fs/promises'
// pdfjs 3.x legacy build：纯 JS 可在 Node 下抽取文本（不渲染页面，无需 canvas 依赖）
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js'

export interface ParsedPdf {
  pages: string[]
  fullText: string
}

interface CacheEntry {
  mtimeMs: number
  value: ParsedPdf
}

let cache: CacheEntry | null = null

/**
 * 解析简历 PDF 的文本层。按 TextItem.hasEOL 还原换行，按文件 mtime 缓存。
 * 仅抽取文本，不做任何渲染；canvas/DOMMatrix 的 polyfill 警告可忽略。
 */
export async function parseResumePdf(filePath: string): Promise<{
  parsed: ParsedPdf
  mtime: Date
  size: number
}> {
  const fileStat = await stat(filePath)

  if (cache && cache.mtimeMs === fileStat.mtimeMs) {
    return { parsed: cache.value, mtime: fileStat.mtime, size: fileStat.size }
  }

  const bytes = Uint8Array.from(await readFile(filePath))
  const document = await getDocument({ data: bytes, useSystemFonts: true }).promise
  const pages: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const lines: string[] = []
      let line = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        line += item.str
        if (item.hasEOL) {
          lines.push(line)
          line = ''
        }
      }
      if (line.trim()) lines.push(line)
      pages.push(lines.join('\n'))
    }
  } finally {
    await document.destroy()
  }

  const parsed: ParsedPdf = { pages, fullText: pages.join('\n') }
  cache = { mtimeMs: fileStat.mtimeMs, value: parsed }
  return { parsed, mtime: fileStat.mtime, size: fileStat.size }
}
