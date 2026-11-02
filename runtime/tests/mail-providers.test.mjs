import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyMailProviderToEnv, mailEnvFromProvider, nextMailServerName } from '../mail-providers.mjs'

test('mailEnvFromProvider fills Gmail hosts from account and password', () => {
  const env = mailEnvFromProvider('gmail', 'a@gmail.com', 'secret')
  assert.equal(env.IMAP_HOST, 'imap.gmail.com')
  assert.equal(env.IMAP_PORT, '993')
  assert.equal(env.IMAP_USER, 'a@gmail.com')
  assert.equal(env.IMAP_PASS, 'secret')
  assert.equal(env.SMTP_HOST, 'smtp.gmail.com')
  assert.equal(env.EMAIL_USER, 'a@gmail.com')
})

test('mailEnvFromProvider fills QQ hosts', () => {
  const env = mailEnvFromProvider('qq', 'a@qq.com', 'code')
  assert.equal(env.IMAP_HOST, 'imap.qq.com')
  assert.equal(env.SMTP_HOST, 'smtp.qq.com')
})

test('applyMailProviderToEnv drops MAIL_PROVIDER from process env', () => {
  const env = applyMailProviderToEnv({}, {
    MAIL_PROVIDER: '163',
    IMAP_USER: 'a@163.com',
    IMAP_PASS: 'code',
  })
  assert.equal(env.MAIL_PROVIDER, undefined)
  assert.equal(env.IMAP_HOST, 'imap.163.com')
  assert.equal(env.IMAP_USER, 'a@163.com')
})

test('nextMailServerName increments past mail', () => {
  assert.equal(nextMailServerName([]), 'mail')
  assert.equal(nextMailServerName(['mail']), 'mail-2')
  assert.equal(nextMailServerName(['mail', 'mail-2']), 'mail-3')
})
