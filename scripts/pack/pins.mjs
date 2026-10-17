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
  commit: 'dc47501012b6463d69398e3bdac70b001d8751fd',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '9a3b30e004c63137c4ce1ffc2388545630b46ad36e76654d1f363797272f23f3',
  },
}

export { NODE_DIST_VERSION } from './node-dist.mjs'
