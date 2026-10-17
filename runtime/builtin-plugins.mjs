export const BUILTIN_PLUGINS = [
  { dir: 'dsh-lan-assist', module: 'dsh-lan-assist', source: { kind: 'vendor' }, health: 'im-business-adapter' },
  { dir: 'dsh-semantic-os', module: 'dsh-semantic-os', source: { kind: 'vendor' }, health: 'semantic-memory' },
  {
    dir: 'iui',
    module: '@losebird/iui',
    source: {
      kind: 'pinned',
      version: '0.13.0-iui.27',
      commit: 'dc47501012b6463d69398e3bdac70b001d8751fd',
      sha256: '9a3b30e004c63137c4ce1ffc2388545630b46ad36e76654d1f363797272f23f3',
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
