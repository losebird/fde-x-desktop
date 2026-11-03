/** IUI pack pin. The packaged runtime copies only runtime/, so this file stays here. */
export const IUI_PIN = {
  repo: 'https://github.com/losebird/IUI.git',
  commit: 'e708848374e78685cd3580c3143eff2cc2c18563',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '1fd07c670c5010f2ed543c5dc6d15e745ed0bdb31055448b4d233e84cc114405',
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
