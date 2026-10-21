import { IUI_PIN } from './iui-pin.mjs'

export const BUILTIN_PLUGINS = [
  { dir: 'dsh-lan-assist', module: 'dsh-lan-assist', source: { kind: 'vendor' }, health: 'im-business-adapter' },
  { dir: 'dsh-semantic-os', module: 'dsh-semantic-os', source: { kind: 'vendor' }, health: 'semantic-memory' },
  {
    dir: 'iui',
    module: '@losebird/iui',
    source: {
      kind: 'pinned',
      version: IUI_PIN.version,
      commit: IUI_PIN.commit,
      sha256: IUI_PIN.artifact.sha256,
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
