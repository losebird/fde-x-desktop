/**
 * FDE imports the lan-assist gate here. Do not load client.js.
 * Host tools still register in the DSH plugin until they call this engine.
 */
export {
  WORKSTATION_CONFIRM_HINT,
  createGate,
  createLanAssistCore,
  createLocalHandler,
  createLookup,
  createNocoWrite,
  createSecretary,
  createSseHub,
  createStore,
  resolveLanAssistConnections,
  wireOfficialOccupancy,
} from './plugins/dsh-lan-assist/engine.js'

export { dispatch } from './plugins/dsh-lan-assist/http.js'
