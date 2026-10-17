export const BUILTIN_PLUGINS = [
  { dir: 'dsh-lan-assist', module: 'dsh-lan-assist', source: { kind: 'vendor' }, health: 'im-business-adapter' },
  { dir: 'dsh-semantic-os', module: 'dsh-semantic-os', source: { kind: 'vendor' }, health: 'semantic-memory' },
  {
    dir: 'iui',
    module: '@losebird/iui',
    source: {
      kind: 'pinned',
      version: '0.13.0-iui.26',
      commit: 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37',
    },
    health: 'ui-sandbox',
    modes: ['standard'],
  },
]

export function pluginEnvKey(dir) {
  return `FDE_PLUGIN_${String(dir).replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`
}

export function builtinBundleNames() {
  return BUILTIN_PLUGINS.map((plugin) => plugin.module)
}

export function builtinStageDirs() {
  return BUILTIN_PLUGINS.map((plugin) => plugin.dir)
}
