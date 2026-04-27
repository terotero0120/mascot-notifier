import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { AppSettings } from '../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  characterFile: 'dance.json',
  displayDuration: 5000,
  displayPosition: 'top-right',
};

const ALLOWED_CHARACTER_FILES: readonly string[] = ['dance.json', 'crab.json'];
const ALLOWED_DISPLAY_POSITIONS: readonly string[] = ['top-right', 'bottom-right'];

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function validateSettings(raw: unknown): AppSettings {
  const r = (raw ?? {}) as Record<string, unknown>;

  const characterFile =
    typeof r.characterFile === 'string' && ALLOWED_CHARACTER_FILES.includes(r.characterFile)
      ? r.characterFile
      : DEFAULT_SETTINGS.characterFile;

  let displayDuration = DEFAULT_SETTINGS.displayDuration;
  if (typeof r.displayDuration === 'number' && !Number.isNaN(r.displayDuration)) {
    displayDuration = Math.min(60000, Math.max(1000, r.displayDuration));
  }

  const displayPosition =
    typeof r.displayPosition === 'string' && ALLOWED_DISPLAY_POSITIONS.includes(r.displayPosition)
      ? (r.displayPosition as AppSettings['displayPosition'])
      : DEFAULT_SETTINGS.displayPosition;

  return { characterFile, displayDuration, displayPosition };
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return validateSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  if (!ALLOWED_CHARACTER_FILES.includes(settings.characterFile)) {
    throw new Error(`Invalid characterFile: ${settings.characterFile}`);
  }
  const validated = validateSettings(settings);
  fs.writeFileSync(settingsPath(), JSON.stringify(validated, null, 2), 'utf-8');
  return validated;
}
