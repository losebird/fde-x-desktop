import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findMail, rememberMail, MAIL_REL } from '../mail-proj.js'

test('rememberMail writes a workspace diary without live ERP fields', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-mail-'))
  await rememberMail(cwd, {
    id: 'req_1',
    fromName: 'Ace',
    excerpt: '请过工单 TK-1，电话 13800138000',
    ref: { kind: '工单', no: 'TK-1' },
    at: 1,
  })
  const diary = await readFile(join(cwd, MAIL_REL), 'utf8')
  assert.match(diary, /出自 req_1:v1/)
  assert.match(diary, /Ace/)
  assert.match(diary, /工单 TK-1/)
  assert.doesNotMatch(diary, /13800138000/)
  assert.equal(existsSync(join(cwd, '.dsh', 'lan-assist', 'mail.sqlite')), true)
  await rememberMail('', { id: 'req_2', excerpt: 'nope' })
  const again = await readFile(join(cwd, MAIL_REL), 'utf8')
  assert.doesNotMatch(again, /nope/)
  const hit = await findMail(cwd, { no: 'TK-1' })
  assert.equal(hit[0].id, 'req_1')
  assert.equal(hit[0].messageId, 'req_1:v1')
})
