/** IUI pack pin. The packaged runtime copies only runtime/, so this file stays here. */
export const IUI_PIN = {
  repo: 'https://github.com/losebird/IUI.git',
  commit: '03f2826b69cf909804e8904e8ab61b6c3ece0820',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: 'da079b4900c4d35b3191f74afb7585404491615330c502d81e42896a1caba268',
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
