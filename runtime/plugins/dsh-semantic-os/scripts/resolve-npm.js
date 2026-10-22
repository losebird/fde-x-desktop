import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function resolveNpmInvocation(execPath = process.execPath, platform = process.platform, env = process.env) {
  const envCli = env.npm_execpath
  if (envCli && existsSync(envCli)) return { command: execPath, prefix: [envCli] }
  const bindir = dirname(execPath)
  const cli = [
    join(bindir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(bindir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(bindir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].find((path) => existsSync(path))
  if (cli) return { command: execPath, prefix: [cli] }
  if (platform === 'win32') {
    const cmd = join(bindir, 'npm.cmd')
    if (existsSync(cmd)) return { command: cmd, prefix: [], shell: true }
    return { command: 'npm.cmd', prefix: [], shell: true }
  }
  return { command: 'npm', prefix: [] }
}
