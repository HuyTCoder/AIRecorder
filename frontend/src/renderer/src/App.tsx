import React from 'react'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { api } from './api/client'
import { useEffect } from 'react'

function App(): React.JSX.Element {
  useEffect(() => {
    api
      .getSettings()
      .then((settings) => {
        document.body.className = `${settings.theme}-theme text-${settings.font_size}`
      })
      .catch(console.error)
  }, [])

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}

export default App
