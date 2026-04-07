interface AppSettings {
  characterFile: string
  displayDuration: number
}

interface ElectronAPI {
  onNotification: (callback: (data: { sender: string; body: string }) => void) => () => void
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
}

interface Window {
  electronAPI: ElectronAPI
}
