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
