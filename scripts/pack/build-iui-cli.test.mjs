import assert from 'node:assert/strict'
import test from 'node:test'
import { IUI_PIN } from './pins.mjs'
import { iuiArtifactPathFromArgv } from './build-iui.mjs'

test('--out writes the pinned archive into that directory', () => {
  const commit = IUI_PIN.commit
  const chosen = iuiArtifactPathFromArgv(['--out', '/var/iui-out'], {
    repoRoot: '/repo',
    commit,
  })
  assert.equal(chosen, `/var/iui-out/iui-${commit}.tar.gz`)
  const equals = iuiArtifactPathFromArgv([`--out=/var/iui-out`], {
    repoRoot: '/repo',
    commit,
  })
  assert.equal(equals, chosen)
  const fallback = iuiArtifactPathFromArgv([], {
    repoRoot: '/repo',
    commit,
  })
  assert.equal(fallback, `/repo/scripts/pack/.cache/iui-${commit}.tar.gz`)
  assert.throws(
    () => iuiArtifactPathFromArgv(['--out'], { repoRoot: '/repo', commit }),
    /--out/,
  )
})
