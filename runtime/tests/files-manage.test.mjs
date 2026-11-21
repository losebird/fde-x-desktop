import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  baseRel,
  isSelfOrDescendant,
  joinRel,
  nextCopyName,
  parentIdOf,
  parentRel,
  remapRel,
  safeWorkspaceRel,
} from '../files-rel.mjs'

test('safeWorkspaceRel keeps nested paths and rejects escapes', () => {
  assert.equal(safeWorkspaceRel('a/b.txt'), 'a/b.txt')
  assert.equal(safeWorkspaceRel('../escape'), null)
  assert.equal(safeWorkspaceRel('a/../b'), null)
  assert.equal(safeWorkspaceRel('.'), null)
})

test('joinRel and parentIdOf treat workspace root as .', () => {
  assert.equal(joinRel('.', 'notes.md'), 'notes.md')
  assert.equal(joinRel('docs', 'notes.md'), 'docs/notes.md')
  assert.equal(parentRel('docs/notes.md'), 'docs')
  assert.equal(parentIdOf('notes.md'), '.')
  assert.equal(baseRel('docs/notes.md'), 'notes.md')
})

test('isSelfOrDescendant blocks moving a folder into itself', () => {
  assert.equal(isSelfOrDescendant('docs', 'docs'), true)
  assert.equal(isSelfOrDescendant('docs', 'docs/in'), true)
  assert.equal(isSelfOrDescendant('docs', 'other'), false)
})

test('remapRel rewrites a moved folder and its children', () => {
  assert.equal(remapRel('docs/a.md', 'docs', 'keep'), 'keep/a.md')
  assert.equal(remapRel('docs', 'docs', 'keep'), 'keep')
  assert.equal(remapRel('other', 'docs', 'keep'), 'other')
})

test('nextCopyName adds 副本 and increments', () => {
  assert.equal(nextCopyName('a.md', []), 'a 副本.md')
  assert.equal(nextCopyName('a.md', ['a 副本.md']), 'a 副本 1.md')
  assert.equal(nextCopyName('folder', ['folder 副本']), 'folder 副本 1')
})
