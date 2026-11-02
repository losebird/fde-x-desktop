import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { applyServerName } from '../mail-tls-sni.cjs'
import { briefingToolErrorText, mailHarvestLabel, mergeMailboxHarvest } from '../briefing/ask-ai.mjs'

const here = dirname(fileURLToPath(import.meta.url))

test('applyServerName fills host when servername is missing', () => {
  const options = { host: 'imap.gmail.com', rejectUnauthorized: true }
  applyServerName(options)
  assert.equal(options.servername, 'imap.gmail.com')
})

test('applyServerName keeps an existing servername', () => {
  const options = { host: 'imap.gmail.com', servername: 'mail.google.com' }
  applyServerName(options)
  assert.equal(options.servername, 'mail.google.com')
})

test('mail launcher requires the SNI preload and maps EMAIL_USER', () => {
  const text = readFileSync(join(here, '..', 'mail-mcp-launch.mjs'), 'utf8')
  assert.match(text, /mail-tls-sni\.cjs/)
  assert.match(text, /EMAIL_USER/)
  assert.match(text, /--require/)
})

test('saving a second mailbox does not overwrite mail.env', () => {
  const text = readFileSync(join(here, '..', 'routes', 'mcp.mjs'), 'utf8')
  assert.match(text, /serverName === 'mail' && env\) writeMailEnvFile/)
  assert.equal(text.includes('isMailMcpServerName(serverName) && env) writeMailEnvFile'), false)
})

test('briefingToolErrorText folds the Node TLS dump', () => {
  const raw = '{"error":"self-signed certificate; if the root CA is installed locally, try running Node.js with --use-system-ca"}'
  assert.equal(briefingToolErrorText(raw), '邮箱安全连接失败（证书）')
})

test('briefingToolErrorText folds Gmail invalid credentials', () => {
  assert.equal(briefingToolErrorText('{"error":"Invalid credentials (Failure)"}'), '邮箱账号或授权码无效')
})

test('mailHarvestLabel follows IMAP host', () => {
  assert.equal(mailHarvestLabel({ serverName: 'mail-2', env: { IMAP_HOST: 'imap.gmail.com' } }), 'Gmail')
  assert.equal(mailHarvestLabel({ serverName: 'QQ-Mail', env: { IMAP_HOST: 'imap.qq.com' } }), 'QQ 邮箱')
})

test('mergeMailboxHarvest keeps a mailbox error next to other items', () => {
  const merged = mergeMailboxHarvest([
    { items: [{ text: 'qq-1' }, { text: 'qq-2' }] },
    { error: 'Gmail：邮箱账号或授权码无效', items: [] },
  ], 5)
  assert.equal(merged.items.length, 2)
  assert.match(merged.error, /Gmail/)
})

test('mergeMailboxHarvest round-robins mailboxes up to the limit', () => {
  const merged = mergeMailboxHarvest([
    { items: [{ text: 'qq-1' }, { text: 'qq-2' }, { text: 'qq-3' }] },
    { items: [{ text: 'g-1' }, { text: 'g-2' }] },
  ], 4)
  assert.deepEqual(merged.items.map((row) => row.text), ['qq-1', 'g-1', 'qq-2', 'g-2'])
})
