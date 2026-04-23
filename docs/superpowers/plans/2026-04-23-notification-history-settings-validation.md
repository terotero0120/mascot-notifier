# 通知履歴書き込み直列化 + 設定バリデーション 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通知履歴の非直列書き込みバグを修正し、設定バリデーションによるパストラバーサルリスクを排除する

**Architecture:** `settings.ts` に `validateSettings()` を追加し load/save 両側で検証する。`notificationHistory.ts` は `writeChain` による直列化と atomic write (tmp→rename) を導入し、書き込み失敗フラグを IPC 経由で renderer に伝播する。

**Tech Stack:** Node.js (fs.promises, rename), Electron IPC, React, Vitest

---

## ファイル構成

| 操作 | ファイル | 変更内容 |
|------|---------|---------|
| Modify | `src/main/settings.ts` | `validateSettings` 追加、`loadSettings`/`saveSettings` 更新 |
| Modify | `src/main/settings.test.ts` | `validateSettings` テスト追加、`saveSettings` throw テスト追加 |
| Modify | `src/main/notificationHistory.ts` | `writeChain` 直列化、atomic write、`writeError` フラグ、`flushNotificationHistory` export |
| Create | `src/main/notificationHistory.test.ts` | 直列化・atomic・writeError の Unit テスト |
| Modify | `src/main/index.ts` | `get-notification-history` ハンドラの戻り値に `writeError` 追加 |
| Modify | `src/renderer/src/electron.d.ts` | `getNotificationHistory` 戻り値型更新 |
| Modify | `src/renderer/src/SettingsApp.tsx` | `saveError` state、`handleSave` try/catch、`writeError` バナー |

---

## Task 1: `validateSettings` の実装 (TDD)

**Files:**
- Modify: `src/main/settings.ts`
- Modify: `src/main/settings.test.ts`

- [ ] **Step 1: `settings.test.ts` に失敗するテストを追加する**

既存の `import { loadSettings, saveSettings } from './settings';` を以下に差し替える。

```typescript
import { loadSettings, saveSettings, validateSettings } from './settings';
```

ファイル末尾に以下のテストを追加する。

```typescript
describe('validateSettings', () => {
  it('returns valid settings unchanged', () => {
    expect(
      validateSettings({
        characterFile: 'crab.json',
        displayDuration: 3000,
        displayPosition: 'bottom-right',
      }),
    ).toEqual({
      characterFile: 'crab.json',
      displayDuration: 3000,
      displayPosition: 'bottom-right',
    });
  });

  it('falls back to default characterFile for path traversal attempt', () => {
    expect(validateSettings({ characterFile: '../../etc/passwd' })).toMatchObject({
      characterFile: 'dance.json',
    });
  });

  it('falls back to default characterFile for unknown file', () => {
    expect(validateSettings({ characterFile: 'custom.json' })).toMatchObject({
      characterFile: 'dance.json',
    });
  });

  it('clamps displayDuration below 1000 to 1000', () => {
    expect(validateSettings({ displayDuration: 100 })).toMatchObject({
      displayDuration: 1000,
    });
  });

  it('clamps displayDuration above 60000 to 60000', () => {
    expect(validateSettings({ displayDuration: 999999 })).toMatchObject({
      displayDuration: 60000,
    });
  });

  it('falls back to default displayDuration for non-number', () => {
    expect(validateSettings({ displayDuration: 'fast' })).toMatchObject({
      displayDuration: 5000,
    });
  });

  it('falls back to default displayPosition for invalid value', () => {
    expect(validateSettings({ displayPosition: 'center' })).toMatchObject({
      displayPosition: 'top-right',
    });
  });

  it('fills missing fields with defaults', () => {
    expect(validateSettings({})).toEqual({
      characterFile: 'dance.json',
      displayDuration: 5000,
      displayPosition: 'top-right',
    });
  });
});
```

`saveSettings` の `describe` ブロックに以下を追加する。

```typescript
  it('throws when characterFile is not in the allowed list', () => {
    expect(() =>
      saveSettings({
        characterFile: '../../malicious.json',
        displayDuration: 5000,
        displayPosition: 'top-right',
      }),
    ).toThrow('Invalid characterFile');
  });
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm test -- --reporter=verbose src/main/settings.test.ts
```

Expected: `validateSettings is not a function` または `throw` テストが FAIL

- [ ] **Step 3: `settings.ts` に `validateSettings` を追加し、`loadSettings`/`saveSettings` を更新する**

`src/main/settings.ts` を以下の内容に全て置き換える。

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface AppSettings {
  characterFile: string;
  displayDuration: number;
  displayPosition: 'top-right' | 'bottom-right';
}

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

export function saveSettings(settings: AppSettings): void {
  if (!ALLOWED_CHARACTER_FILES.includes(settings.characterFile)) {
    throw new Error(`Invalid characterFile: ${settings.characterFile}`);
  }
  const validated = validateSettings(settings);
  fs.writeFileSync(settingsPath(), JSON.stringify(validated, null, 2), 'utf-8');
}
```

- [ ] **Step 4: テストが全て通ることを確認する**

```bash
npm test -- --reporter=verbose src/main/settings.test.ts
```

Expected: 全テスト PASS（既存テストも含む）

- [ ] **Step 5: コミットする**

```bash
git add src/main/settings.ts src/main/settings.test.ts
git commit -m "feat: settings バリデーション追加（characterFile whitelist + displayDuration clamp）"
```

---

## Task 2: Renderer の保存エラー表示

**Files:**
- Modify: `src/renderer/src/SettingsApp.tsx`

- [ ] **Step 1: `saveError` state を追加し `handleSave` を try/catch で囲む**

`SettingsApp.tsx` の `const [saved, setSaved] = useState(false);` の直後に以下を追加する。

```typescript
  const [saveError, setSaveError] = useState<string | null>(null);
```

`handleSave` 関数全体を以下に置き換える。

```typescript
  const handleSave = async () => {
    try {
      await window.electronAPI.saveSettings({
        characterFile,
        displayDuration: displayDuration * 1000,
        displayPosition,
      });
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(String(err));
    }
  };
```

- [ ] **Step 2: 保存ボタン直後にエラー表示を追加する**

`SettingsApp.tsx` の `{saved && (...)}` の直後に以下を追加する。

```tsx
          {saveError && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#e53935' }}>
              {saveError}
            </div>
          )}
```

- [ ] **Step 3: ビルドが通ることを確認する**

```bash
npm run build 2>&1 | tail -20
```

Expected: エラーなし

- [ ] **Step 4: コミットする**

```bash
git add src/renderer/src/SettingsApp.tsx
git commit -m "feat: 設定保存失敗時にエラーメッセージを表示"
```

---

## Task 3: 通知履歴書き込みの直列化 + Atomic write (TDD)

**Files:**
- Create: `src/main/notificationHistory.test.ts`
- Modify: `src/main/notificationHistory.ts`

- [ ] **Step 1: 失敗するテストファイルを作成する**

`src/main/notificationHistory.test.ts` を新規作成する。

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/mascot-test'),
  },
}));

const readFileSyncMock = vi.fn();
const writeFileMock = vi.fn();
const renameMock = vi.fn();

vi.mock('node:fs', () => ({
  default: {
    readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
    promises: {
      writeFile: (...args: unknown[]) => writeFileMock(...args),
      rename: (...args: unknown[]) => renameMock(...args),
    },
  },
}));

import {
  _resetStateForTesting,
  addDisplayedNotification,
  flushNotificationHistory,
  getHistoryData,
} from './notificationHistory';

describe('notificationHistory', () => {
  beforeEach(() => {
    _resetStateForTesting();
    readFileSyncMock.mockReset();
    writeFileMock.mockReset();
    renameMock.mockReset();
    readFileSyncMock.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    writeFileMock.mockResolvedValue(undefined);
    renameMock.mockResolvedValue(undefined);
  });

  describe('addDisplayedNotification', () => {
    it('ignores entries without dbId', async () => {
      addDisplayedNotification({ sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('deduplicates entries with the same dbId', async () => {
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello again' });
      await flushNotificationHistory();
      const lastCall = writeFileMock.mock.calls[writeFileMock.mock.calls.length - 1];
      const written = JSON.parse(lastCall[1] as string) as unknown[];
      expect(written).toHaveLength(1);
    });

    it('serializes concurrent writes so the latest snapshot is written last', async () => {
      let resolveFirst!: () => void;
      writeFileMock
        .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }))
        .mockResolvedValue(undefined);

      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      addDisplayedNotification({ dbId: '2', sender: 'Bob', body: 'World' });

      resolveFirst();
      await flushNotificationHistory();

      expect(writeFileMock).toHaveBeenCalledTimes(2);
      const lastWrite = JSON.parse(writeFileMock.mock.calls[1][1] as string) as Array<{ dbId: string }>;
      expect(lastWrite).toHaveLength(2);
      expect(lastWrite[0].dbId).toBe('2');
      expect(lastWrite[1].dbId).toBe('1');
    });

    it('writes to a tmp file and renames to the final path (atomic write)', async () => {
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();

      const tmpPath = writeFileMock.mock.calls[0][0] as string;
      const [renameSrc, renameDst] = renameMock.mock.calls[0] as [string, string];
      expect(tmpPath).toBe('/tmp/mascot-test/displayed-notifications.json.tmp');
      expect(renameSrc).toBe('/tmp/mascot-test/displayed-notifications.json.tmp');
      expect(renameDst).toBe('/tmp/mascot-test/displayed-notifications.json');
    });
  });

  describe('writeError flag', () => {
    it('sets writeError to true when writeFile throws', async () => {
      writeFileMock.mockRejectedValue(new Error('disk full'));
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(true);
    });

    it('clears writeError after a subsequent successful write', async () => {
      writeFileMock.mockRejectedValueOnce(new Error('disk full'));
      addDisplayedNotification({ dbId: '1', sender: 'Alice', body: 'Hello' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(true);

      addDisplayedNotification({ dbId: '2', sender: 'Bob', body: 'World' });
      await flushNotificationHistory();
      expect(getHistoryData(new Set()).writeError).toBe(false);
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm test -- --reporter=verbose src/main/notificationHistory.test.ts
```

Expected: `_resetStateForTesting is not a function` または `flushNotificationHistory is not a function` で FAIL

- [ ] **Step 3: `notificationHistory.ts` を更新する**

`src/main/notificationHistory.ts` を以下の内容に全て置き換える。

```typescript
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

const MAX_ENTRIES = 200;
let cache: DisplayedEntry[] | null = null;
let writeChain: Promise<void> = Promise.resolve();
let lastWriteError = false;

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

function flushAsync(): void {
  const snapshot = JSON.stringify(cache ?? []);
  const target = getHistoryPath();
  const tmp = `${target}.tmp`;

  writeChain = writeChain
    .then(() => fs.promises.writeFile(tmp, snapshot))
    .then(() => fs.promises.rename(tmp, target))
    .then(() => {
      lastWriteError = false;
    })
    .catch((err) => {
      lastWriteError = true;
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
  writeChain = Promise.resolve();
  lastWriteError = false;
}
```

- [ ] **Step 4: テストが全て通ることを確認する**

```bash
npm test -- --reporter=verbose src/main/notificationHistory.test.ts
```

Expected: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/main/notificationHistory.ts src/main/notificationHistory.test.ts
git commit -m "feat: 通知履歴書き込みを直列化し atomic write を導入"
```

---

## Task 4: `writeError` の IPC 伝播と履歴タブへのバナー表示

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/electron.d.ts`
- Modify: `src/renderer/src/SettingsApp.tsx`

- [ ] **Step 1: `index.ts` の `get-notification-history` ハンドラを更新する**

`ipcMain.handle('get-notification-history', ...)` の `return` 文を以下に変更する。

変更前:
```typescript
    return [...markedDbRecords, ...historyOnlyRecords]
      .sort((a, b) => b.unixMs - a.unixMs)
      .slice(0, 30);
```

変更後:
```typescript
    return {
      records: [...markedDbRecords, ...historyOnlyRecords]
        .sort((a, b) => b.unixMs - a.unixMs)
        .slice(0, 30),
      writeError,
    };
```

同ハンドラ内の `const { displayedIds, historyOnly } = getHistoryData(dbIdSet);` を以下に変更する。

```typescript
    const { displayedIds, historyOnly, writeError } = getHistoryData(dbIdSet);
```

- [ ] **Step 2: `electron.d.ts` の `getNotificationHistory` 戻り値型を更新する**

`src/renderer/src/electron.d.ts` の `getNotificationHistory` の行を以下に変更する。

変更前:
```typescript
  getNotificationHistory: () => Promise<LatestNotificationRecord[]>;
```

変更後:
```typescript
  getNotificationHistory: () => Promise<{ records: LatestNotificationRecord[]; writeError: boolean }>;
```

- [ ] **Step 3: `SettingsApp.tsx` の `HistoryState` 型を更新し、getNotificationHistory 呼び出しを修正する**

`HistoryState` 型を以下に変更する。

変更前:
```typescript
type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; records: LatestNotificationRecord[] }
  | { status: 'error'; message: string };
```

変更後:
```typescript
type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; records: LatestNotificationRecord[]; writeError: boolean }
  | { status: 'error'; message: string };
```

`getNotificationHistory()` の `.then()` を以下に変更する。

変更前:
```typescript
      .then((records) => setHistoryState({ status: 'success', records }))
```

変更後:
```typescript
      .then(({ records, writeError }) =>
        setHistoryState({ status: 'success', records, writeError }),
      )
```

- [ ] **Step 4: 履歴タブに writeError バナーを追加する**

`SettingsApp.tsx` の `<div style={{ overflowY: 'auto', flex: 1 }}>` の直後（`{historyState.status === 'loading' && ...}` の前）に以下を追加する。

```tsx
            {historyState.status === 'success' && historyState.writeError && (
              <div
                style={{
                  padding: '6px 12px',
                  marginBottom: 8,
                  borderRadius: 4,
                  background: '#FFF3E0',
                  color: '#E65100',
                  fontSize: 12,
                }}
              >
                履歴の保存に失敗しました
              </div>
            )}
```

- [ ] **Step 5: ビルドと全テストが通ることを確認する**

```bash
npm run build 2>&1 | tail -20
```

```bash
npm test 2>&1 | tail -30
```

Expected: ビルドエラーなし、全テスト PASS

- [ ] **Step 6: コミットする**

```bash
git add src/main/index.ts src/renderer/src/electron.d.ts src/renderer/src/SettingsApp.tsx
git commit -m "feat: writeError フラグを IPC 経由で伝播し履歴タブにバナー表示"
```

---

## 最終確認

- [ ] **全テスト実行**

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **lint チェック**

```bash
npm run lint
```

Expected: エラーなし
