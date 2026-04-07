import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface AppSettings {
  characterFile: string
  displayDuration: number
}

const DEFAULT_SETTINGS: AppSettings = {
  characterFile: 'dance.json',
  displayDuration: 5000
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
