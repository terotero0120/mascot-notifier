import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onNotification: (callback: (data: { sender: string; body: string }) => void) => {
    ipcRenderer.on('notification', (_event, data) => callback(data))
  }
})
