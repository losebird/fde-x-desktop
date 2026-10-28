export const BUILTIN_PLUGINS = []

export function pluginEnvKey(dir) {
  return `FDE_PLUGIN_${String(dir).replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`
}

export function builtinBundleNames() {
  return BUILTIN_PLUGINS.map((plugin) => plugin.module)
}

export function builtinStageDirs() {
  return BUILTIN_PLUGINS.map((plugin) => plugin.dir)
}
