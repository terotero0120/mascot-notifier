interface AppSettings {
  characterFile: string;
  displayDuration: number;
  displayPosition: 'top-right' | 'bottom-right';
}

interface ElectronAPI {
  onNotification: (
    callback: (data: { sender: string; body: string; appName?: string }) => void,
  ) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
}
