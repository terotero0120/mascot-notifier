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
}

const MAX_ENTRIES = 200;
let cache: DisplayedEntry[] | null = null;

function getHistoryPath(): string {
  return path.join(app.getPath('userData'), 'displayed-notifications.json');
}

function getEntries(): DisplayedEntry[] {
  if (cache === null) {
    try {
      cache = JSON.parse(fs.readFileSync(getHistoryPath(), 'utf-8')) as DisplayedEntry[];
    } catch {
      cache = [];
    }
  }
  return cache;
}

let flushChain: Promise<void> = Promise.resolve();

function flushAsync(): void {
  const snapshot = JSON.stringify(cache ?? []);
  flushChain = flushChain
    .then(() => fs.promises.writeFile(getHistoryPath(), snapshot))
    .catch((err) => {
      console.error('Failed to save notification history:', err);
    });
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
  };
}
