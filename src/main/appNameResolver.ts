import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const cache = new Map<string, string>();

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

function resolveAppNameWin(appId: string): string {
  const cleaned = appId.split('!')[0];
  const parts = cleaned.split('.');
  const last = parts[parts.length - 1].replace(/_.*$/, '');
  return last || appId;
}

function fallbackName(identifier: string): string {
  const parts = identifier.split('.');
  return parts[parts.length - 1] || identifier;
}

export async function resolveAppName(identifier: string): Promise<string> {
  if (!identifier) return '';

  const known = KNOWN_APPS[identifier];
  if (known) return known;

  const cached = cache.get(identifier);
  if (cached) return cached;

  let name: string;
  if (process.platform === 'darwin') {
    name = await resolveAppNameMac(identifier);
  } else {
    name = resolveAppNameWin(identifier);
  }

  cache.set(identifier, name);
  return name;
}
