import assert from 'node:assert/strict'
import test from 'node:test'
import { pathsFromText } from '../eyes-media.js'

test('pathsFromText keeps Chinese workspace paths', () => {
  const text = '请看 /Users/zxz/Documents/聊天技巧/加微信开场白.docx 和 /Users/zxz/Documents/聊天技巧/04、无限聊天话题技巧(1).pdf。'
  const found = pathsFromText(text)
  assert.ok(found.includes('/Users/zxz/Documents/聊天技巧/加微信开场白.docx'))
  assert.ok(found.includes('/Users/zxz/Documents/聊天技巧/04、无限聊天话题技巧(1).pdf'))
})

test('pathsFromText still matches ascii paths', () => {
  const found = pathsFromText('see /tmp/notes.docx please')
  assert.deepEqual(found, ['/tmp/notes.docx'])
})

test('pathsFromText matches old Office names', () => {
  const found = pathsFromText('看 /Users/zxz/Documents/聊天技巧/6_流氓兔恋爱培训资料2.doc')
  assert.deepEqual(found, ['/Users/zxz/Documents/聊天技巧/6_流氓兔恋爱培训资料2.doc'])
})
