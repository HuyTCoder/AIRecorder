import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  reloadApp: () => ipcRenderer.send('app-reload'),
  showSaveDialog: (defaultFilename: string) =>
    ipcRenderer.invoke('show-save-dialog', defaultFilename),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore: window typing is extended at runtime in Electron preload fallback
  window.electronAPI = electronAPI
}
