export const BUILTIN_PLUGINS = [
  { dir: 'dsh-lan-assist', module: 'dsh-lan-assist', source: { kind: 'vendor' }, health: 'im-business-adapter' },
  { dir: 'dsh-semantic-os', module: 'dsh-semantic-os', source: { kind: 'vendor' }, health: 'semantic-memory' },
  {
    dir: 'iui',
    module: '@losebird/iui',
    source: {
      kind: 'pinned',
      version: '0.13.0-iui.27',
      commit: '10db57b326a228e19e3093fcd694ae2ac5951408',
      sha256: 'c171f532ccd01e3b66272d9a364aefaaef7cd47dd37bcc4dd5444991998b634c',
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
