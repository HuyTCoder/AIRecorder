import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { UIState, UIAction, uiReducer, initialState } from './reducer'

interface AppContextType {
  state: UIState
  dispatch: React.Dispatch<UIAction>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState)

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
