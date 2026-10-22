import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickedDirectory } from '../cwd.mjs'

test('picked directory accepts a unix path, a drive letter, and a UNC path', () => {
  assert.equal(pickedDirectory('/home/a/'), '/home/a')
  assert.equal(pickedDirectory('C:\\Users\\a\\'), 'C:/Users/a')
  assert.equal(pickedDirectory('\\\\server\\share\\'), '//server/share')
  assert.equal(pickedDirectory('proj'), '')
})
