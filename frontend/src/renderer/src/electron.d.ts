interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  reloadApp: () => void
  showSaveDialog: (defaultFilename: string) => Promise<{ filePath: string | undefined }>
  writeFile: (filePath: string, content: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
