import { contextBridge, ipcRenderer } from 'electron';

function createListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  onNotification: (callback: (data: { sender: string; body: string; appName?: string }) => void) =>
    createListener('notification', callback),
  onSettingsChanged: (
    callback: (settings: {
      characterFile: string;
      displayDuration: number;
      displayPosition: 'top-right' | 'bottom-right';
    }) => void,
  ) => createListener('settings-changed', callback),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: {
    characterFile: string;
    displayDuration: number;
    displayPosition: 'top-right' | 'bottom-right';
  }) => ipcRenderer.invoke('save-settings', settings),
  getNotificationHistory: () => ipcRenderer.invoke('get-notification-history'),
  onNavigateTab: (callback: (tab: string) => void) => createListener('navigate-tab', callback),
  onHistoryWriteError: (callback: (hasError: boolean) => void) =>
    createListener('history-write-error', callback),
});
