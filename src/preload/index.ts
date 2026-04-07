import { contextBridge, ipcRenderer } from 'electron'

function createListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onNotification: (callback: (data: { sender: string; body: string }) => void) =>
    createListener('notification', callback),
  onSettingsChanged: (callback: (settings: { characterFile: string; displayDuration: number }) => void) =>
    createListener('settings-changed', callback),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: { characterFile: string; displayDuration: number }) =>
    ipcRenderer.invoke('save-settings', settings)
})
