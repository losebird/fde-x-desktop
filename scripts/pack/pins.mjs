/** Locked versions for Electron resources staging (spec 09 §6). */
import { HOST_GENERATION } from '../../runtime/generation.mjs'

export const DSH_NPM_VERSION = HOST_GENERATION.pin

export const SEMANTIC_RUNTIME = {
  runtimeVersion: '0.1.1',
  releaseTag: 'v0.1.1',
  releaseBaseUrl:
    'https://github.com/losebird/dsh-semantic-os/releases/download/v0.1.1',
}

export const IUI_PIN = {
  repo: 'https://github.com/losebird/IUI.git',
  commit: '00d2fee598620b7d10a547f948d85ade8089a53e',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '2e50249ac0f83a9fee13ed7e5b30e66de23de1f5d92a4721171f557718b240c6',
  },
}

export { NODE_DIST_VERSION } from './node-dist.mjs'
