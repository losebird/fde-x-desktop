/** IUI pack pin. The packaged runtime copies only runtime/, so this file stays here. */
export const IUI_PIN = {
  repo: 'https://github.com/losebird/IUI.git',
  commit: '77c23c7c3e9cfc991e0bed9fb44b0a4ea66fd57c',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '9fffca3342019fea28ddc1e4328ea06afa045571998e5635ce470c5f239f0d64',
  },
}

/** FDE library descriptor. Not a Host builtin plugin. */
export const IUI_LIBRARY = {
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
}
