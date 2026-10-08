import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

/** Vendor checkout junk. Sidecar Python lives in resources/semantic-runtime only. */
export const PLUGIN_SKIP_DIRS = new Set([
  'release-dist',
  'runtime-dist',
  'node_modules',
  '.git',
  '.npm-cache',
  '.playwright-cli',
  '.dsh',
  'output',
  'ui',
  'test',
  'docs',
  '__pycache__',
])

function skipName(name) {
  return PLUGIN_SKIP_DIRS.has(name) || name === '推广图'
}

export async function pluginCopyList(from) {
  const pkgPath = join(from, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    return Array.isArray(pkg.files) ? pkg.files.map(String).filter(Boolean) : null
  } catch {
    return null
  }
}

export async function stagePluginTree(from, to) {
  if (!existsSync(from)) return false
  await rm(to, { recursive: true, force: true })
  await mkdir(dirname(to), { recursive: true })
  const listed = await pluginCopyList(from)
  const extras = ['package.json', 'LICENSE', 'README.md', 'cordis.patch.yml']
  if (listed && listed.length) {
    await mkdir(to, { recursive: true })
    for (const name of extras) {
      const src = join(from, name)
      if (existsSync(src)) await cp(src, join(to, name), { dereference: true })
    }
    for (const entry of listed) {
      if (skipName(entry.split(/[\\/]/u)[0])) continue
      const src = join(from, entry)
      if (!existsSync(src)) continue
      await cp(src, join(to, entry), {
        recursive: true,
        dereference: true,
        filter: (srcPath) => !skipName(basename(srcPath)),
      })
    }
    return true
  }
  await cp(from, to, {
    recursive: true,
    dereference: true,
    filter: (srcPath) => {
      if (srcPath === from) return true
      const rel = relative(from, srcPath)
      const top = rel.split(/[\\/]/u)[0]
      return !skipName(top) && !skipName(basename(srcPath))
    },
  })
  return true
}
