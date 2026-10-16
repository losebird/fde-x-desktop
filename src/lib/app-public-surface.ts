import { createContext, useContext } from 'react'

export const AppPublicSurface = createContext(false)

export function useAppPublicSurface() {
  return useContext(AppPublicSurface)
}
