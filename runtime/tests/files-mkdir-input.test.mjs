import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')
const files = readFileSync(join(root, 'src/pages/Files.tsx'), 'utf8')

test('新文件夹 uses an in-page input instead of window.prompt', () => {
  assert.doesNotMatch(files, /window\.prompt/)
  assert.match(files, /placeholder="文件夹名称"/)
  assert.match(files, /aria-label="文件夹名称"/)
  assert.match(files, /setFolderDraft\(''\)/)
  assert.match(files, /event\.key === 'Enter'/)
  assert.match(files, /event\.key === 'Escape'/)
  assert.match(files, /mkdirWorkspace/)
  assert.match(files, /请填写文件夹名称/)
  assert.match(files, /创建文件夹失败/)
  assert.match(files, />创建</)
  assert.match(files, />取消</)
  assert.match(files, /filesError && <span className="text-xs text-accent-red/)
})

test('Files page exposes rename copy move and folder delete', () => {
  assert.match(files, /moveWorkspaceFile/)
  assert.match(files, /copyWorkspaceFile/)
  assert.match(files, /application\/x-fde-move/)
  assert.match(files, /title="重命名"/)
  assert.match(files, /title="复制"/)
  assert.match(files, /title="剪切"/)
  assert.match(files, /ClipboardPaste size=\{14\} \/> 粘贴/)
  assert.match(files, /pendingDelete/)
  assert.match(files, /deleteWorkspaceFile\(id, sessionId\)/)
  assert.doesNotMatch(files, /deleteWorkspaceFile\(f\.name/)
})

test('Files uses multi-select cut and paste instead of hijacking the tree', () => {
  assert.match(files, /pickedIds/)
  assert.match(files, /setClipboard/)
  assert.match(files, /pasteInto/)
  assert.match(files, /已选 \{pickedIds.length\} 项/)
  assert.match(files, /bg-brand-soft/)
  assert.match(files, /title="单击选择，双击打开"/)
  assert.doesNotMatch(files, /pendingMove/)
  assert.doesNotMatch(files, /点一个文件夹，把/)
})

test('cut can be withdrawn before paste and last paste can be undone', () => {
  assert.match(files, /clearClipboard/)
  assert.match(files, /撤回剪切/)
  assert.match(files, /undoLastOp/)
  assert.match(files, /event\.key === 'Escape' && clipboard/)
  assert.match(files, /文件仍在原处/)
})

test('file migration drag stays on the Files page and does not fall through to the AI composer', () => {
  assert.match(files, /function trapMoveDrag/)
  assert.match(files, /onDragOver=\{trapMoveDrag\}/)
  assert.match(files, /onDrop=\{trapMoveDrag\}/)
  assert.match(files, /event\.stopPropagation\(\)/)
  const ai = readFileSync(join(root, 'src/pages/AI.tsx'), 'utf8')
  assert.match(ai, /data-ai-drop/)
  assert.match(ai, /isAiDropHost/)
  assert.match(ai, /closest\('\[data-ai-drop\]'\)/)
})
