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
  commit: 'c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37',
  version: '0.13.0-iui.26',
  artifact: {
    url: '',
    sha256: '4530e8a9c5f4f29c0bcdd6daa09ef5ee7a615755033991643820d8c1cc294ea5',
  },
}

export { NODE_DIST_VERSION } from './node-dist.mjs'
