import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { githubRemoteUrls, redactSecrets, trimReadToken } from './github-auth.mjs'

const execFileAsync = promisify(execFile)

test('trimReadToken drops only surrounding whitespace', () => {
  assertTrim('  github_pat_abc \n', 'github_pat_abc')
  assertTrim('', '')
  assertTrim('   ', '')
})

function assertTrim(input, expected) {
  if (trimReadToken(input) !== expected) {
    throw new Error(`trim ${JSON.stringify(input)} => ${JSON.stringify(trimReadToken(input))}`)
  }
}

test('githubRemoteUrls puts a trimmed token in x-access-token and keeps a clean URL', () => {
  const auth = githubRemoteUrls('losebird/dsh-lan-assist', ' \n github_pat_example \t')
  if (auth.token !== 'github_pat_example') throw new Error(`token ${auth.token}`)
  if (auth.cleanUrl !== 'https://github.com/losebird/dsh-lan-assist.git') {
    throw new Error(auth.cleanUrl)
  }
  if (auth.fetchUrl !== 'https://x-access-token:github_pat_example@github.com/losebird/dsh-lan-assist.git') {
    throw new Error(auth.fetchUrl)
  }
  if (auth.cleanUrl.includes('github_pat_example') || auth.cleanUrl.includes('x-access-token')) {
    throw new Error('clean URL contains credentials')
  }
  const empty = githubRemoteUrls('losebird/dsh-semantic-os', '  ')
  if (empty.token !== '' || empty.fetchUrl !== empty.cleanUrl) {
    throw new Error('blank token must not invent credentials')
  }
  const spaced = githubRemoteUrls('losebird/dsh-semantic-os', ' a b ')
  if (spaced.fetchUrl !== 'https://x-access-token:a%20b@github.com/losebird/dsh-semantic-os.git') {
    throw new Error(spaced.fetchUrl)
  }
})

test('redactSecrets removes the token, its encoding, and token-shaped leftovers', () => {
  const auth = githubRemoteUrls('losebird/dsh-lan-assist', ' github_pat_supersecret ')
  const leaked = `Command failed: git remote add origin ${auth.fetchUrl}\nbearer ${auth.token}`
  const redacted = redactSecrets(leaked, auth.token)
  for (const secret of [auth.token, 'github_pat_supersecret', 'x-access-token:github_pat_supersecret']) {
    if (redacted.includes(secret)) throw new Error(`still visible: ${secret}\n${redacted}`)
  }
  if (!redacted.includes('x-access-token:[REDACTED]')) throw new Error(redacted)
  const spaced = githubRemoteUrls('losebird/dsh-lan-assist', 'a b')
  const spacedRedacted = redactSecrets(spaced.fetchUrl, spaced.token)
  if (spacedRedacted.includes('a%20b') || spacedRedacted.includes('a b')) {
    throw new Error(spacedRedacted)
  }
})

test('git remote set-url removes the x-access-token URL', async () => {
  const auth = githubRemoteUrls('losebird/dsh-lan-assist', 'github_pat_exampletoken')
  const dir = await mkdtemp(join(tmpdir(), 'fde-github-auth-'))
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: dir })
    await execFileAsync('git', ['remote', 'add', 'origin', auth.fetchUrl], { cwd: dir })
    await execFileAsync('git', ['remote', 'set-url', 'origin', auth.cleanUrl], { cwd: dir })
    const { stdout } = await execFileAsync('git', ['config', '--local', '--get', 'remote.origin.url'], { cwd: dir })
    if (stdout.trim() !== auth.cleanUrl) throw new Error(stdout)
    if (stdout.includes(auth.token) || stdout.includes('x-access-token')) {
      throw new Error(stdout)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
