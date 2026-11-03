/** IUI pack pin. The packaged runtime copies only runtime/, so this file stays here. */
export const IUI_PIN = {
  repo: 'https://github.com/losebird/IUI.git',
  commit: 'f428b504a4d39ee70362631dee98a17e1317ac22',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '85ab613cfa64930bc4b2171835530277f5e7c6596b32c9e37de80fda91670afe',
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
