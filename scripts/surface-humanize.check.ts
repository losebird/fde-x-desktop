import assert from 'node:assert/strict'
import { classifySurfaceFailure, humanizeSurfaceMessage } from '../src/components/surface/phase.ts'

const fallback = '这一步没有完成。'

function runtimeError(status: number, code: string, message: string) {
  return { name: 'RuntimeApiError', status, code, message }
}

const fetchFailure = classifySurfaceFailure(
  runtimeError(0, 'runtime_unreachable', 'TypeError: Failed to fetch'),
  fallback,
)
assert.equal(fetchFailure.phase, 'unreachable')
assert.equal(fetchFailure.message, '连不上本机核心。确认工作台已启动后再试。')
assert.equal(
  humanizeSurfaceMessage('TypeError: Failed to fetch', fallback),
  fetchFailure.message,
)

const coreDown = classifySurfaceFailure(
  runtimeError(503, 'ai/not-connected', '核心未接通，无法 settings/mutate'),
  fallback,
)
assert.equal(coreDown.phase, 'coreDown')
assert.match(coreDown.message, /核心还没接通/)
assert.equal(coreDown.message.includes('settings/mutate'), false)

const disconnected = classifySurfaceFailure(
  runtimeError(503, 'core_disconnected', '核心未连接，无法保存设置'),
  fallback,
)
assert.equal(disconnected.phase, 'coreDown')

const validation = classifySurfaceFailure(
  runtimeError(400, 'validation_error', '名称不能为空'),
  fallback,
)
assert.equal(validation.phase, 'error')
assert.equal(validation.message, '名称不能为空')

const missing = classifySurfaceFailure(
  runtimeError(404, 'not_found', 'mcp server missing'),
  fallback,
)
assert.equal(missing.phase, 'error')
assert.equal(missing.message, '没有找到这一项。')
assert.equal(missing.message.includes('mcp'), false)

assert.equal(
  humanizeSurfaceMessage('会话投影到 list_mcp_resources 后才有资源', fallback),
  '这一场会话还没有资源。先添加服务器，再重载核心。',
)
assert.equal(humanizeSurfaceMessage('核心未接通', fallback), '核心未接通')
assert.equal(humanizeSurfaceMessage('   ', fallback), fallback)
assert.equal(humanizeSurfaceMessage('GET /api/v1/mcp 500', fallback), fallback)
assert.equal(humanizeSurfaceMessage('语义设置失败：HTTP 404', fallback), fallback)

console.log('surface-humanize ok')
