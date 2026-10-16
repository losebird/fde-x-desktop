import assert from 'node:assert/strict'
import { humanizeSurfaceMessage } from '../src/components/surface/humanize.ts'

const fallback = '这一步没有完成。'

assert.equal(
  humanizeSurfaceMessage('TypeError: Failed to fetch', fallback),
  '连不上本机核心。确认工作台已启动后再试。',
)
assert.equal(
  humanizeSurfaceMessage('会话投影到 list_mcp_resources 后才有资源', fallback),
  '这一场会话还没有资源。先添加服务器，再重载核心。',
)
assert.equal(
  humanizeSurfaceMessage('Host yaml library is missing', fallback),
  '本机核心缺配置库，暂时读不到这项。',
)
assert.equal(humanizeSurfaceMessage('核心未接通', fallback), '核心未接通')
assert.equal(humanizeSurfaceMessage('   ', fallback), fallback)
assert.equal(humanizeSurfaceMessage('GET /api/v1/mcp 500', fallback), fallback)

console.log('surface-humanize ok')
