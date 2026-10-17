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
  commit: '10db57b326a228e19e3093fcd694ae2ac5951408',
  version: '0.13.0-iui.27',
  artifact: {
    url: '',
    sha256: 'c171f532ccd01e3b66272d9a364aefaaef7cd47dd37bcc4dd5444991998b634c',
  },
}

export { NODE_DIST_VERSION } from './node-dist.mjs'
