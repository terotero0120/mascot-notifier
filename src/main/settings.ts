import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface AppSettings {
  characterFile: string
  displayDuration: number
}

const ALLOWED_CHARACTER_FILES = new Set(['dance.json', 'crab.json'])
const MIN_DISPLAY_DURATION = 1000
const MAX_DISPLAY_DURATION = 10000

const DEFAULT_SETTINGS: AppSettings = {
  characterFile: 'dance.json',
  displayDuration: 5000
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeSettings(settings: unknown): AppSettings {
  if (!isObject(settings)) return { ...DEFAULT_SETTINGS }

  const normalized: AppSettings = { ...DEFAULT_SETTINGS }

  if (typeof settings.characterFile === 'string' && ALLOWED_CHARACTER_FILES.has(settings.characterFile)) {
    normalized.characterFile = settings.characterFile
  }

  if (
    typeof settings.displayDuration === 'number' &&
    Number.isFinite(settings.displayDuration) &&
    Number.isInteger(settings.displayDuration) &&
    settings.displayDuration >= MIN_DISPLAY_DURATION &&
    settings.displayDuration <= MAX_DISPLAY_DURATION
  ) {
    normalized.displayDuration = settings.displayDuration
  }

  return normalized
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return normalizeSettings(parsed)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: unknown): AppSettings {
  const normalized = normalizeSettings(settings)
  fs.writeFileSync(settingsPath(), JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}
