const REPLACEMENTS: Array<{ test: RegExp; say: string }> = [
  { test: /failed to fetch|networkerror|load failed|network request failed/i, say: '连不上本机核心。确认工作台已启动后再试。' },
  { test: /list_mcp_resources/i, say: '这一场会话还没有资源。先添加服务器，再重载核心。' },
  { test: /host yaml library is missing/i, say: '本机核心缺配置库，暂时读不到这项。' },
  { test: /econnrefused|connect econn|socket hang up/i, say: '本机核心没有在听。先启动工作台。' },
]

const TECHNICAL = /failed to fetch|list_mcp_|\/api\/v1|econn|typeerror|syntaxerror|error:|yaml library|undefined is not/i

export function humanizeSurfaceMessage(raw: string, fallback: string) {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  for (const rule of REPLACEMENTS) {
    if (rule.test.test(text)) return rule.say
  }
  if (TECHNICAL.test(text)) return fallback
  return text
}
