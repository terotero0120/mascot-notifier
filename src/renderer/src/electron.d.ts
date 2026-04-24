interface AppSettings {
  characterFile: string;
  displayDuration: number;
  displayPosition: 'top-right' | 'bottom-right';
}

interface LatestNotificationRecord {
  id: number;
  timestamp: string;
  unixMs: number;
  sender: string;
  body: string;
  appName: string;
  rawId: string;
  displayedByApp: boolean;
}

interface ElectronAPI {
  onNotification: (
    callback: (data: { sender: string; body: string; appName?: string }) => void,
  ) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getNotificationHistory: () => Promise<{
    records: LatestNotificationRecord[];
    writeError: boolean;
  }>;
  onNavigateTab: (callback: (tab: string) => void) => () => void;
  onHistoryWriteError: (callback: (hasError: boolean) => void) => () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
