import './support/no-stray-processes.mjs'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const censusImport = 'no-stray-processes.mjs'

export function missingCensusMounts(files) {
  return files
    .filter((file) => !file.source.includes(censusImport))
    .map((file) => file.name)
}

function runtimeTests() {
  return readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => ({
      name: `runtime/tests/${name}`,
      source: readFileSync(new URL(name, import.meta.url), 'utf8'),
    }))
}

test('every runtime test mounts the stray census', () => {
  const missing = missingCensusMounts(runtimeTests())
  assert.deepEqual(missing, [], `tests without stray census:\n${missing.join('\n')}`)
})

test('a file that skips the census mount is named', () => {
  const missing = missingCensusMounts([
    { name: 'runtime/tests/left-out.test.mjs', source: 'test("x", () => {})\n' },
    { name: 'runtime/tests/mounted.test.mjs', source: "import './support/no-stray-processes.mjs'\n" },
  ])
  assert.deepEqual(missing, ['runtime/tests/left-out.test.mjs'])
})
