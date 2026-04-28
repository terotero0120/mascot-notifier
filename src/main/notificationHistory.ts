import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { formatNotificationTimestamp } from './monitors/base';

interface DisplayedEntry {
  dbId: string;
  unixMs: number;
  timestamp: string;
  sender: string;
  body: string;
  appName: string;
  rawId: string;
}

export interface HistoryData {
  displayedIds: Set<string>;
  historyOnly: DisplayedEntry[];
  writeError: boolean;
}

const MAX_ENTRIES = 30;
let cache: DisplayedEntry[] | null = null;
let loadFailed = false;
let writeChain: Promise<void> = Promise.resolve();
let lastWriteError = false;
let writeErrorCallback: ((hasError: boolean) => void) | null = null;

export function setWriteErrorCallback(cb: (hasError: boolean) => void): void {
  writeErrorCallback = cb;
}

function getHistoryPath(): string {
  return path.join(app.getPath('userData'), 'displayed-notifications.json');
}

function isValidEntry(e: unknown): e is DisplayedEntry {
  if (e == null || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.dbId === 'string' &&
    typeof r.unixMs === 'number' &&
    typeof r.timestamp === 'string' &&
    typeof r.sender === 'string' &&
    typeof r.body === 'string' &&
    typeof r.appName === 'string' &&
    typeof r.rawId === 'string'
  );
}

function getEntries(): DisplayedEntry[] {
  if (cache === null) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(getHistoryPath(), 'utf-8'));
      cache = Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
      loadFailed = false;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        cache = [];
        loadFailed = false;
      } else {
        // Transient I/O error: keep cache null so next read retries,
        // and set loadFailed to prevent flushing over existing on-disk data.
        console.error('Failed to read notification history:', err);
        loadFailed = true;
      }
    }
  }
  return cache ?? [];
}

function flushAsync(): void {
  const snapshot = JSON.stringify(cache ?? []);
  const target = getHistoryPath();
  const tmp = `${target}.tmp`;

  writeChain = writeChain
    .then(() => fs.promises.writeFile(tmp, snapshot))
    .then(() => fs.promises.rename(tmp, target))
    .then(() => {
      lastWriteError = false;
      writeErrorCallback?.(false);
    })
    .catch((err) => {
      lastWriteError = true;
      writeErrorCallback?.(true);
      console.error('Failed to save notification history:', err);
    });
}

export function flushNotificationHistory(): Promise<void> {
  return writeChain;
}

export function addDisplayedNotification(data: {
  dbId?: string;
  unixMs?: number;
  sender: string;
  body: string;
  appName?: string;
  rawId?: string;
}): void {
  if (!data.dbId) return;

  const entries = getEntries();
  if (loadFailed) return;

  if (entries.some((e) => e.dbId === data.dbId)) return;

  const unixMs = data.unixMs ?? Date.now();
  entries.unshift({
    dbId: data.dbId,
    unixMs,
    timestamp: formatNotificationTimestamp(unixMs),
    sender: data.sender,
    body: data.body,
    appName: data.appName ?? '',
    rawId: data.rawId ?? '',
  });

  if (entries.length > MAX_ENTRIES) {
    entries.splice(MAX_ENTRIES);
  }

  flushAsync();
}

export function getHistoryData(dbIdSet: Set<string>): HistoryData {
  const entries = getEntries();
  return {
    displayedIds: new Set(entries.map((e) => e.dbId)),
    historyOnly: entries.filter((e) => !dbIdSet.has(e.dbId)),
    writeError: lastWriteError,
  };
}

export function _resetStateForTesting(): void {
  cache = null;
  loadFailed = false;
  writeChain = Promise.resolve();
  lastWriteError = false;
  writeErrorCallback = null;
}
