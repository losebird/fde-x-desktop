import { humanizeSurfaceMessage } from '@/components/surface/phase'
import type { McpServerV2 } from '@/lib/runtime-api'

export type McpDraft = {
  name: string
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string
  env: string
  url: string
  headers: string
  recipeId: string
  fieldValues: Record<string, string>
}

export type DraftErrors = {
  name?: string
  command?: string
  url?: string
  env?: string
  headers?: string
}

const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/u

export function emptyDraft(): McpDraft {
  return {
    name: '',
    transport: 'stdio',
    command: '',
    args: '',
    env: '',
    url: '',
    headers: '',
    recipeId: '',
    fieldValues: {},
  }
}

export function transportLabel(transport: string) {
  return transport === 'streamable-http' ? '网络地址' : '本机命令'
}

export function statusLabel(status: McpServerV2['status']) {
  switch (status) {
    case 'loaded': return '已加载'
    case 'loading': return '加载中'
    case 'unloading': return '卸载中'
    case 'needs-reload': return '需重载'
    case 'configured': return '已配置'
    case 'failed': return '加载失败'
    case 'disabled': return '已停用'
    default: return '未就绪'
  }
}

export function commandLine(row: { transport: string; url?: string; command?: string; args?: string[] }) {
  if (row.transport === 'streamable-http') return row.url || ''
  return [row.command, ...(Array.isArray(row.args) ? row.args : [])].filter(Boolean).join(' ')
}

export function parseLines(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

export function lineProblems(text: string, mark: '=' | ':') {
  const problems: string[] = []
  text.split('\n').forEach((line, index) => {
    if (!line.trim()) return
    if (line.indexOf(mark) <= 0) problems.push(`第 ${index + 1} 行缺少「${mark}」`)
  })
  return problems
}

function parsePairs(text: string, mark: '=' | ':') {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const at = line.indexOf(mark)
    if (at <= 0) continue
    const key = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    if (key) out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

export function parseEnv(text: string) {
  return parsePairs(text, '=')
}

export function parseHeaders(text: string) {
  return parsePairs(text, ':')
}

export function envText(env?: Record<string, string>) {
  if (!env) return ''
  return Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n')
}

export function headersText(headers?: Record<string, string>) {
  if (!headers) return ''
  return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n')
}

export function validateDraft(draft: McpDraft, existing: string[], editing: string): DraftErrors {
  const errors: DraftErrors = {}
  const name = (editing || draft.name).trim()
  if (!editing) {
    if (!name) errors.name = '要填写名称。'
    else if (!NAME_RE.test(name)) errors.name = '只能用字母、数字、- 和 _，最多 32 个字。'
    else if (existing.includes(name)) errors.name = '这个名字已经有了。'
  }
  if (draft.transport === 'stdio') {
    if (!draft.command.trim()) errors.command = '要填写启动命令。'
    const envProblem = lineProblems(draft.env, '=')[0]
    if (envProblem) errors.env = envProblem
  } else {
    const url = String(draft.fieldValues.url || draft.url || '').trim()
    if (!url) errors.url = '要填写地址。'
    else {
      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') errors.url = '地址只接受 http 或 https。'
      } catch {
        errors.url = '地址不合法。'
      }
    }
    const headerProblem = lineProblems(draft.headers, ':')[0]
    if (headerProblem) errors.headers = headerProblem
  }
  return errors
}

export function draftInput(draft: McpDraft, editing: string, cwd?: string) {
  const serverName = (editing || draft.name).trim()
  const fieldEnv = Object.fromEntries(
    Object.entries(draft.fieldValues).filter(([key, value]) => key !== 'url' && String(value || '').trim()),
  )
  const mergedEnv = { ...(parseEnv(draft.env) || {}), ...fieldEnv }
  if (draft.transport === 'stdio') {
    return {
      serverName,
      transport: 'stdio' as const,
      command: draft.command.trim(),
      args: parseLines(draft.args),
      env: Object.keys(mergedEnv).length ? mergedEnv : undefined,
      ...(cwd ? { cwd } : {}),
    }
  }
  return {
    serverName,
    transport: 'streamable-http' as const,
    url: String(draft.fieldValues.url || draft.url || '').trim(),
    headers: parseHeaders(draft.headers),
  }
}

export function probeCopy(result: { ok: boolean; message: string }) {
  if (result.ok) return '连接成功。'
  const message = result.message || ''
  if (message === 'timeout') return '没有在限定时间内响应。'
  if (/找不到文件/.test(message)) return message
  if (/PATH 里找不到/.test(message)) return '本机找不到这个命令。'
  if (/不可执行/.test(message)) return '这个命令不能执行。'
  if (/stdio 退出|initialize|MCP/.test(message)) return '命令启动后没有完成握手。'
  return humanizeSurfaceMessage(message, '没有连上。')
}

export function toolLabel(serverName: string, name: string) {
  const prefix = `mcp__${serverName}__`
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}
