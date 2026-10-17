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
  commit: '77c23c7c3e9cfc991e0bed9fb44b0a4ea66fd57c',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: '9fffca3342019fea28ddc1e4328ea06afa045571998e5635ce470c5f239f0d64',
  },
}

export { NODE_DIST_VERSION } from './node-dist.mjs'
