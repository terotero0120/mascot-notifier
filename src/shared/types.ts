export interface AppSettings {
  characterFile: string;
  displayDuration: number;
  displayPosition: 'top-right' | 'bottom-right';
}

export interface NotificationData {
  sender: string;
  body: string;
  appName?: string;
  dbId?: string;
  unixMs?: number;
  rawId?: string;
}

export interface LatestNotificationRecord {
  id: number;
  timestamp: string;
  unixMs: number;
  sender: string;
  body: string;
  appName: string;
  rawId: string;
  displayedByApp: boolean;
}

export interface NotificationHistoryResponse {
  records: LatestNotificationRecord[];
  writeError: boolean;
}

export type SettingsTab = 'settings' | 'history';

export interface ElectronAPI {
  onNotification: (callback: (data: NotificationData) => void) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getNotificationHistory: () => Promise<NotificationHistoryResponse>;
  onNavigateTab: (callback: (tab: string) => void) => () => void;
  onHistoryWriteError: (callback: (hasError: boolean) => void) => () => void;
}
