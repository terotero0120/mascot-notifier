import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { AppSettings, NotificationData, SettingsTab } from '../shared/types';

function createListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  onNotification: (callback: (data: NotificationData) => void) =>
    createListener(IPC_CHANNELS.NOTIFICATION, callback),
  onSettingsChanged: (callback: (settings: AppSettings) => void) =>
    createListener(IPC_CHANNELS.SETTINGS_CHANGED, callback),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  getNotificationHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_NOTIFICATION_HISTORY),
  onNavigateTab: (callback: (tab: SettingsTab) => void) =>
    createListener(IPC_CHANNELS.NAVIGATE_TAB, callback),
  onHistoryWriteError: (callback: (hasError: boolean) => void) =>
    createListener(IPC_CHANNELS.HISTORY_WRITE_ERROR, callback),
});
