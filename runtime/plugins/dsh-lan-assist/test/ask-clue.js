import { SPOKEN, withSpoken } from './spoken-pack.js'

export { SPOKEN, withSpoken }

export const ASK_CLUE = (SPOKEN.clues || []).find((row) => row && row.role === '问句') || { role: '问句', say: [] }
