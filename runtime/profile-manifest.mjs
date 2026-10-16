import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Merge Host-persisted profile bundle selection with FDE isolation scaffolding. */

export function mergeProfileManifest(existing, { profileName, requiredBundles }) {
  const prev = existing && typeof existing === 'object' ? existing : {}
  const dsh = prev.dsh && typeof prev.dsh === 'object' ? prev.dsh : {}
  const profile = dsh.profile && typeof dsh.profile === 'object' ? dsh.profile : {}
  const kept = Array.isArray(profile.bundles)
    ? profile.bundles.filter((name) => typeof name === 'string' && name.trim())
    : []
  const bundles = []
  for (const name of [...requiredBundles, ...kept]) {
    if (typeof name === 'string' && name.trim() && !bundles.includes(name)) bundles.push(name)
  }
  return {
    ...prev,
    name: typeof prev.name === 'string' && prev.name.trim() ? prev.name : `dsh-profile-${profileName}`,
    private: true,
    dsh: {
      ...dsh,
      profile: {
        ...profile,
        bundles,
      },
    },
  }
}

export async function readProfileManifestFile(packagePath) {
  let raw
  try {
    raw = await readFile(packagePath, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return null
    throw error
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    const invalid = new Error(`profile package.json 无法解析，未覆盖：${packagePath}`)
    invalid.code = 'FDE_PROFILE_MANIFEST_INVALID'
    invalid.cause = error
    throw invalid
  }
}

export async function writeMergedProfileManifest(packagePath, options) {
  const existing = await readProfileManifestFile(packagePath)
  const manifest = mergeProfileManifest(existing, options)
  const body = `${JSON.stringify(manifest, null, 2)}\n`
  await mkdir(dirname(packagePath), { recursive: true })
  const temporary = `${packagePath}.${process.pid}.tmp`
  try {
    await writeFile(temporary, body)
    await rename(temporary, packagePath)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  return manifest
}
