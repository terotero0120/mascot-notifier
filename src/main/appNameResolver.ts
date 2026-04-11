import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class BoundedCache extends Map<string, string> {
  constructor(private readonly maxEntries: number) {
    super();
  }

  override get(key: string): string | undefined {
    const value = super.get(key);
    if (value === undefined) return undefined;
    super.delete(key);
    super.set(key, value);
    return value;
  }

  override set(key: string, value: string): this {
    if (super.has(key)) {
      super.delete(key);
    }
    super.set(key, value);
    if (this.size > this.maxEntries) {
      const oldestKey = this.keys().next().value;
      if (oldestKey !== undefined) {
        super.delete(oldestKey);
      }
    }
    return this;
  }
}

const cache = new BoundedCache(256);

const KNOWN_APPS: Record<string, string> = {
  'com.apple.MobileSMS': 'メッセージ',
  'com.apple.mail': 'メール',
  'com.apple.iCal': 'カレンダー',
  'com.apple.reminders': 'リマインダー',
  'com.apple.FaceTime': 'FaceTime',
  'com.apple.Safari': 'Safari',
  'com.apple.Notes': 'メモ',
  'com.apple.finder': 'Finder',
  'com.apple.Music': 'ミュージック',
  'com.tinyspeck.slackmacgap': 'Slack',
  'jp.naver.line.mac': 'LINE',
  'com.microsoft.teams2': 'Microsoft Teams',
  'com.microsoft.Outlook': 'Outlook',
  'com.google.Chrome': 'Google Chrome',
  'com.todoist.mac.Todoist': 'Todoist',
  'ru.keepcoder.Telegram': 'Telegram',
  'com.hnc.Discord': 'Discord',
  'Microsoft.Teams': 'Microsoft Teams',
  'com.squirrel.slack.slack': 'Slack',
  'Microsoft.WindowsStore': 'Microsoft Store',
  'Microsoft.OutlookForWindows': 'Outlook',
};

async function resolveAppNameMac(bundleId: string): Promise<string> {
  try {
    const { stdout: appPath } = await execFileAsync(
      'mdfind',
      [`kMDItemCFBundleIdentifier=${bundleId}`],
      { timeout: 2000 },
    );
    const firstPath = appPath.trim().split('\n')[0];
    if (!firstPath) return fallbackName(bundleId);

    const { stdout: displayName } = await execFileAsync(
      'mdls',
      ['-name', 'kMDItemDisplayName', '-raw', firstPath],
      { timeout: 2000 },
    );
    const name = displayName.trim();
    if (name && name !== '(null)') return name;
  } catch {
    // fall through to fallback
  }
  return fallbackName(bundleId);
}

const NON_DESCRIPTIVE_SEGMENTS = new Set([
  'stable',
  'beta',
  'dev',
  'canary',
  'nightly',
  'release',
  'app',
  'exe',
  'desktop',
]);

const KNOWN_PWA_HOSTS: Record<string, string> = {
  'chat.google.com': 'Google Chat',
  'mail.google.com': 'Gmail',
  'calendar.google.com': 'Google Calendar',
  'docs.google.com': 'Google Docs',
  'meet.google.com': 'Google Meet',
  'drive.google.com': 'Google Drive',
  'web.whatsapp.com': 'WhatsApp',
  'open.spotify.com': 'Spotify',
  'twitter.com': 'X',
  'x.com': 'X',
};

export function resolveAppNameWin(appId: string): string {
  const exclamationIdx = appId.indexOf('!');
  if (exclamationIdx !== -1) {
    const afterExcl = appId.slice(exclamationIdx + 1);
    if (afterExcl.startsWith('http://') || afterExcl.startsWith('https://')) {
      try {
        const url = new URL(afterExcl);
        const pwaName = KNOWN_PWA_HOSTS[url.hostname];
        if (pwaName) return pwaName;
        const hostParts = url.hostname.split('.');
        return hostParts.length >= 2 ? hostParts[hostParts.length - 2] : url.hostname;
      } catch {
        // malformed URL, fall through
      }
    }
  }

  const cleaned = exclamationIdx !== -1 ? appId.slice(0, exclamationIdx) : appId;
  const parts = cleaned.split('.');
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i].replace(/_.*$/, '');
    if (segment && !NON_DESCRIPTIVE_SEGMENTS.has(segment.toLowerCase())) {
      return segment;
    }
  }
  return parts[0]?.replace(/_.*$/, '') || appId;
}

export function fallbackName(identifier: string): string {
  const parts = identifier.split('.');
  return parts[parts.length - 1] || identifier;
}

export function normalizeWinId(appId: string): string {
  return appId.split('!')[0].replace(/_.*$/, '');
}

const inflight = new Map<string, Promise<string>>();

export async function resolveAppName(identifier: string): Promise<string> {
  if (!identifier) return '';

  const isWin = process.platform !== 'darwin';
  const lookupKey = isWin ? normalizeWinId(identifier) : identifier;

  const known = KNOWN_APPS[lookupKey];
  if (known) return known;

  const cached = cache.get(lookupKey);
  if (cached) return cached;

  const existing = inflight.get(lookupKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const name = isWin ? resolveAppNameWin(identifier) : await resolveAppNameMac(identifier);
      cache.set(lookupKey, name);
      return name;
    } finally {
      inflight.delete(lookupKey);
    }
  })();

  inflight.set(lookupKey, promise);
  return promise;
}
