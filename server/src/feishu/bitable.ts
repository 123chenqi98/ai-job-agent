import { config } from '../config.js'
import { feishuRequest } from './client.js'

// 飞书 wiki 节点信息
export interface WikiNode {
  title: string
  obj_type: 'bitable' | 'sheet' | 'doc' | string
  obj_token: string
  node_token: string
  space_id: string
}

export interface FieldMeta {
  field_name: string
  type: number
  ui_type?: string
  property?: { options?: Array<{ name: string }> }
}

export interface BitableRecord {
  record_id: string
  fields: Record<string, unknown>
}

// 解析 wiki 链接中的节点，拿到真实对象类型与 token
export async function getWikiNode(nodeToken: string): Promise<WikiNode> {
  const data = await feishuRequest<{ node: WikiNode }>('GET', '/wiki/v2/spaces/get_node', {
    query: { token: nodeToken },
  })
  return data.node
}

// 电子表格元信息（v2 接口会返回内嵌多维表的 blockToken，格式为 {app_token}_{table_id}）
export interface MetaSheet {
  sheetId: string
  title: string
  rowCount: number
  blockToken?: string
  blockType?: string
}

export async function getSpreadsheetMetainfo(
  spreadsheetToken: string,
): Promise<{ title: string; sheets: MetaSheet[] }> {
  const data = await feishuRequest<{
    properties: { title: string }
    sheets: Array<{
      sheetId: string
      title: string
      rowCount: number
      blockInfo?: { blockToken: string; blockType: string }
    }>
  }>('GET', `/sheets/v2/spreadsheets/${spreadsheetToken}/metainfo`)

  return {
    title: data.properties?.title ?? '',
    sheets: (data.sheets || []).map((s) => ({
      sheetId: s.sheetId,
      title: s.title,
      rowCount: s.rowCount,
      blockToken: s.blockInfo?.blockToken,
      blockType: s.blockInfo?.blockType,
    })),
  }
}

export async function listFields(appToken: string, tableId: string): Promise<FieldMeta[]> {
  const data = await feishuRequest<{ items: FieldMeta[] }>(
    'GET',
    `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    { query: { page_size: 100 } },
  )
  return data.items || []
}

// 只读搜索记录（search 接口支持分页、过滤、排序）
export interface SearchOptions {
  pageSize?: number
  pageToken?: string
  filter?: unknown
  sort?: unknown
}

export async function searchRecords(
  appToken: string,
  tableId: string,
  options: SearchOptions = {},
): Promise<{ total: number; hasMore: boolean; pageToken?: string; items: BitableRecord[] }> {
  const body: Record<string, unknown> = {}
  if (options.filter) body.filter = options.filter
  if (options.sort) body.sort = options.sort

  const data = await feishuRequest<{
    total: number
    has_more: boolean
    page_token?: string
    items: BitableRecord[]
  }>('POST', `/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`, {
    query: { page_size: options.pageSize ?? 100, page_token: options.pageToken },
    body,
  })
  return {
    total: data.total,
    hasMore: data.has_more,
    pageToken: data.page_token,
    items: data.items || [],
  }
}

// 拉取一张数据表的全部记录（内部自动翻页，设上限保护；可带 filter/sort 服务端过滤排序）
export async function searchAllRecords(
  appToken: string,
  tableId: string,
  options: SearchOptions & { limit?: number } = {},
): Promise<BitableRecord[]> {
  const limit = options.limit ?? 2000
  const records: BitableRecord[] = []
  let pageToken: string | undefined
  do {
    const page = await searchRecords(appToken, tableId, {
      pageSize: options.pageSize ?? 500,
      pageToken,
      filter: options.filter,
      sort: options.sort,
    })
    records.push(...page.items)
    pageToken = page.hasMore ? page.pageToken : undefined
    if (records.length >= limit) break
  } while (pageToken)
  return records
}

// blockToken 形如 Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_tblxxxxxxxxxxxx，拆出 app_token 与 table_id
function parseBlockToken(blockToken: string): { appToken: string; tableId: string } | undefined {
  const matched = blockToken.match(/^(.+)_(tbl\w+)$/)
  if (!matched) return undefined
  return { appToken: matched[1], tableId: matched[2] }
}

export interface EmbeddedTable {
  tableId: string
  title: string
  rows: number
}

export interface ResolvedApp {
  node: WikiNode
  appToken: string
  tables: EmbeddedTable[]
}

// 解析 wiki 节点并拿到内嵌多维表的 app_token；同一电子表格内的多个数据表共享该 app_token
export async function resolveApp(): Promise<ResolvedApp> {
  const node = await getWikiNode(config.feishu.wikiNode)

  if (node.obj_type === 'bitable') {
    return { node, appToken: node.obj_token, tables: [] }
  }
  if (node.obj_type !== 'sheet') {
    throw new Error(`暂不支持的 wiki 节点类型：${node.obj_type}`)
  }

  const meta = await getSpreadsheetMetainfo(node.obj_token)
  const tables: EmbeddedTable[] = []
  let appToken: string | undefined

  for (const sheet of meta.sheets) {
    if (!sheet.blockToken) continue
    const parsed = parseBlockToken(sheet.blockToken)
    if (!parsed) continue
    appToken = parsed.appToken
    tables.push({ tableId: parsed.tableId, title: sheet.title, rows: sheet.rowCount })
  }

  if (!appToken) {
    throw new Error('未能在电子表格中定位到内嵌多维表格，请检查应用的电子表格读取权限')
  }
  return { node, appToken, tables }
}
