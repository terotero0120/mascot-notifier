# IPC/Renderer 型定義 src/shared/ 集約 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `AppSettings`・`NotificationData` などの IPC 境界型と IPC チャンネル名を `src/shared/` に集約し、main/preload/renderer 間のドリフトを型レベルで防ぐ。

**Architecture:** `src/shared/types.ts` に全共有型、`src/shared/ipc-channels.ts` に IPC チャンネル名定数を新規作成する。既存の重複定義を削除し、各ファイルが shared からインポートするよう変更する。`electron.d.ts` は `Window.electronAPI` 拡張のみに絞り、`declare global + export {}` 形式に変換する。

**Tech Stack:** TypeScript, Electron, React, electron-vite, Biome（lint）, Vitest（test）

---

## ファイル構成

| 操作 | パス | 内容 |
|---|---|---|
| **新規作成** | `src/shared/types.ts` | 全共有型定義 |
| **新規作成** | `src/shared/ipc-channels.ts` | IPC チャンネル名定数 |
| **変更** | `tsconfig.node.json` | `src/shared/**/*` を include に追加 |
| **変更** | `tsconfig.web.json` | `src/shared/**/*` を include に追加 |
| **変更** | `src/main/settings.ts` | `AppSettings` を削除 → shared からインポート |
| **変更** | `src/main/monitors/base.ts` | `NotificationData`・`LatestNotificationRecord` を削除 → shared からインポート |
| **変更** | `src/main/index.ts` | `IPC_CHANNELS` 使用・`SettingsTab`・`AppSettings` を shared からインポート |
| **変更** | `src/preload/index.ts` | インライン型削除・`IPC_CHANNELS` 使用 |
| **変更** | `src/renderer/src/electron.d.ts` | `Window` 拡張のみ残す・`declare global + export {}` 形式に変換 |
| **変更** | `src/renderer/src/CharacterOverlay.tsx` | ローカル `NotificationData` 削除 → shared インポート |
| **変更** | `src/renderer/src/SettingsApp.tsx` | ローカル `Tab` 型削除 → `SettingsTab` を shared インポート |

---

### Task 1: src/shared/types.ts を作成する

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: ファイルを作成する**

`src/shared/types.ts` を以下の内容で作成する：

```typescript
export interface AppSettings {
  characterFile: string;
  displayDuration: number;
  displayPosition: 'top-right' | 'bottom-right';
}

export interface NotificationData {
  sender: string;
  body: string;
  appName?: string;
  dbId?: string;
  unixMs?: number;
  rawId?: string;
}

export interface LatestNotificationRecord {
  id: number;
  timestamp: string;
  unixMs: number;
  sender: string;
  body: string;
  appName: string;
  rawId: string;
  displayedByApp: boolean;
}

export interface NotificationHistoryResponse {
  records: LatestNotificationRecord[];
  writeError: boolean;
}

export type SettingsTab = 'settings' | 'history';

export interface ElectronAPI {
  onNotification: (callback: (data: NotificationData) => void) => () => void;
  onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  getNotificationHistory: () => Promise<NotificationHistoryResponse>;
  onNavigateTab: (callback: (tab: string) => void) => () => void;
  onHistoryWriteError: (callback: (hasError: boolean) => void) => () => void;
}
```

- [ ] **Step 2: コミット**

```bash
git add src/shared/types.ts
git commit -m "feat: shared/types.ts を新規作成"
```

---

### Task 2: src/shared/ipc-channels.ts を作成する

**Files:**
- Create: `src/shared/ipc-channels.ts`

- [ ] **Step 1: ファイルを作成する**

`src/shared/ipc-channels.ts` を以下の内容で作成する：

```typescript
export const IPC_CHANNELS = {
  NOTIFICATION: 'notification',
  SETTINGS_CHANGED: 'settings-changed',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  GET_NOTIFICATION_HISTORY: 'get-notification-history',
  NAVIGATE_TAB: 'navigate-tab',
  HISTORY_WRITE_ERROR: 'history-write-error',
} as const;
```

- [ ] **Step 2: コミット**

```bash
git add src/shared/ipc-channels.ts
git commit -m "feat: shared/ipc-channels.ts を新規作成"
```

---

### Task 3: tsconfig に src/shared を追加する

**Files:**
- Modify: `tsconfig.node.json`
- Modify: `tsconfig.web.json`

- [ ] **Step 1: tsconfig.node.json を更新する**

`tsconfig.node.json` の `include` を以下に変更する：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "outDir": "./out",
    "rootDir": ".",
    "strict": true,
    "skipLibCheck": true
  },
  "include": [
    "src/main/**/*",
    "src/preload/**/*",
    "src/shared/**/*",
    "electron-vite.config.ts"
  ]
}
```

- [ ] **Step 2: tsconfig.web.json を更新する**

`tsconfig.web.json` の `include` を以下に変更する：

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "outDir": "./out",
    "rootDir": ".",
    "strict": true,
    "skipLibCheck": true
  },
  "include": [
    "src/renderer/**/*",
    "src/shared/**/*"
  ]
}
```

- [ ] **Step 3: コミット**

```bash
git add tsconfig.node.json tsconfig.web.json
git commit -m "chore: tsconfig に src/shared を追加"
```

---

### Task 4: src/main/settings.ts を更新する

**Files:**
- Modify: `src/main/settings.ts`

- [ ] **Step 1: AppSettings を削除し shared からインポートする**

`src/main/settings.ts` を以下に変更する：

```typescript
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
```

変更点: 先頭の `export interface AppSettings { ... }` ブロックを削除し、`import type { AppSettings } from '../shared/types';` を追加。

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS（既存の settings.test.ts が通過すること）

- [ ] **Step 3: コミット**

```bash
git add src/main/settings.ts
git commit -m "refactor: AppSettings を shared/types からインポート"
```

---

### Task 5: src/main/monitors/base.ts を更新する

**Files:**
- Modify: `src/main/monitors/base.ts`

- [ ] **Step 1: NotificationData・LatestNotificationRecord を削除し shared からインポートする**

`src/main/monitors/base.ts` の先頭を以下に変更する（`EventEmitter` import の直後に shared import を追加し、型定義ブロックを削除する）：

```typescript
import { EventEmitter } from 'node:events';
import type { LatestNotificationRecord, NotificationData } from '../../shared/types';

export type { NotificationData, LatestNotificationRecord };

export function formatNotificationTimestamp(unixMs: number): string {
  return new Date(unixMs).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ... (BaseNotificationMonitor クラス以降は変更なし)
```

変更点:
- `export interface NotificationData { ... }` ブロックを削除
- `export interface LatestNotificationRecord { ... }` ブロックを削除
- shared からインポートし、`export type { NotificationData, LatestNotificationRecord }` で再エクスポート（`notificationMonitor.ts` の既存の re-export が壊れないようにするため）

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/main/monitors/base.ts
git commit -m "refactor: NotificationData/LatestNotificationRecord を shared/types からインポート"
```

---

### Task 6: src/main/index.ts を更新する

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: インポートを更新する**

`src/main/index.ts` のインポートセクションを以下に変更する：

既存:
```typescript
import { type AppSettings, loadSettings, saveSettings } from './settings';
```

変更後（`AppSettings` と `SettingsTab` を shared から、`IPC_CHANNELS` を追加）:
```typescript
import type { AppSettings, SettingsTab } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { loadSettings, saveSettings } from './settings';
```

- [ ] **Step 2: ローカルの SettingsTab 型定義を削除する**

以下の行を削除する（`src/main/index.ts:135`）:
```typescript
type SettingsTab = 'settings' | 'history';
```

- [ ] **Step 3: IPC チャンネル文字列を IPC_CHANNELS 定数に置き換える**

以下の置き換えを行う（全7箇所）:

| 変更前 | 変更後 |
|---|---|
| `settingsWindow.webContents.send('navigate-tab', initialTab)` | `settingsWindow.webContents.send(IPC_CHANNELS.NAVIGATE_TAB, initialTab)` |
| `overlayWindow?.webContents.send('notification', {...})` (2箇所) | `overlayWindow?.webContents.send(IPC_CHANNELS.NOTIFICATION, {...})` |
| `settingsWindow?.webContents.send('history-write-error', hasError)` | `settingsWindow?.webContents.send(IPC_CHANNELS.HISTORY_WRITE_ERROR, hasError)` |
| `ipcMain.handle('get-settings', ...)` | `ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, ...)` |
| `ipcMain.handle('save-settings', ...)` | `ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, ...)` |
| `overlayWindow?.webContents.send('settings-changed', validated)` | `overlayWindow?.webContents.send(IPC_CHANNELS.SETTINGS_CHANGED, validated)` |
| `ipcMain.handle('get-notification-history', ...)` | `ipcMain.handle(IPC_CHANNELS.GET_NOTIFICATION_HISTORY, ...)` |
| `overlayWindow?.webContents.send('notification', notification)` | `overlayWindow?.webContents.send(IPC_CHANNELS.NOTIFICATION, notification)` |

- [ ] **Step 4: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/main/index.ts
git commit -m "refactor: AppSettings/SettingsTab を shared からインポート、IPC_CHANNELS 定数を使用"
```

---

### Task 7: src/preload/index.ts を更新する

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: ファイル全体を以下に置き換える**

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { AppSettings, NotificationData } from '../shared/types';

function createListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  onNotification: (callback: (data: NotificationData) => void) =>
    createListener(IPC_CHANNELS.NOTIFICATION, callback),
  onSettingsChanged: (callback: (settings: AppSettings) => void) =>
    createListener(IPC_CHANNELS.SETTINGS_CHANGED, callback),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),
  getNotificationHistory: () => ipcRenderer.invoke(IPC_CHANNELS.GET_NOTIFICATION_HISTORY),
  onNavigateTab: (callback: (tab: string) => void) =>
    createListener(IPC_CHANNELS.NAVIGATE_TAB, callback),
  onHistoryWriteError: (callback: (hasError: boolean) => void) =>
    createListener(IPC_CHANNELS.HISTORY_WRITE_ERROR, callback),
});
```

変更点:
- インライン型定義（`{ sender: string; body: string; appName?: string }` など）を削除
- `import type { AppSettings, NotificationData } from '../shared/types'` を追加
- `import { IPC_CHANNELS } from '../shared/ipc-channels'` を追加
- チャンネル文字列リテラルを `IPC_CHANNELS.*` 定数に置き換え

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/preload/index.ts
git commit -m "refactor: preload の型を shared からインポート、IPC_CHANNELS 定数を使用"
```

---

### Task 8: src/renderer/src/electron.d.ts を更新する

**Files:**
- Modify: `src/renderer/src/electron.d.ts`

- [ ] **Step 1: ファイル全体を以下に置き換える**

```typescript
import type { ElectronAPI } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

変更点:
- `AppSettings`・`LatestNotificationRecord`・`ElectronAPI` の定義をすべて削除
- `ElectronAPI` を shared からインポート
- `import type` を追加するとモジュール扱いになるため `declare global {}` でラップし `export {}` を追加

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/electron.d.ts
git commit -m "refactor: electron.d.ts を Window 拡張のみに絞り ElectronAPI を shared からインポート"
```

---

### Task 9: src/renderer/src/CharacterOverlay.tsx を更新する

**Files:**
- Modify: `src/renderer/src/CharacterOverlay.tsx`

- [ ] **Step 1: ローカル NotificationData を削除し shared からインポートする**

ファイル先頭を以下に変更する：

変更前:
```typescript
import Lottie from 'lottie-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface NotificationData {
  sender: string;
  body: string;
  appName?: string;
}
```

変更後:
```typescript
import Lottie from 'lottie-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, NotificationData } from '../../shared/types';
```

変更点:
- ローカルの `interface NotificationData { ... }` を削除
- `AppSettings` と `NotificationData` を shared からインポート（`AppSettings` はこれまでグローバル `electron.d.ts` 経由で参照されていたが、明示的インポートに変える）

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/CharacterOverlay.tsx
git commit -m "refactor: NotificationData/AppSettings を shared からインポート"
```

---

### Task 10: src/renderer/src/SettingsApp.tsx を更新する

**Files:**
- Modify: `src/renderer/src/SettingsApp.tsx`

- [ ] **Step 1: インポートを追加しローカル Tab 型を削除する**

ファイル先頭を以下に変更する：

変更前:
```typescript
import type React from 'react';
import { useEffect, useState } from 'react';

// ...（定数定義）...

type Tab = 'settings' | 'history';
```

変更後:
```typescript
import type React from 'react';
import { useEffect, useState } from 'react';
import type { LatestNotificationRecord, SettingsTab as Tab } from '../../shared/types';

// ...（定数定義）...

// type Tab = 'settings' | 'history'; ← 削除（shared の SettingsTab を Tab として使用）
```

変更点:
- `import type { LatestNotificationRecord, SettingsTab as Tab } from '../../shared/types'` を追加
- ローカルの `type Tab = 'settings' | 'history'` を削除
- `LatestNotificationRecord` はこれまでグローバル `electron.d.ts` 経由で参照されていたが、明示的インポートに変える
- `SettingsTab as Tab` とエイリアスを使うため、ファイル内の `Tab` の使用箇所は変更不要

- [ ] **Step 2: テストを実行して通過を確認する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/SettingsApp.tsx
git commit -m "refactor: LatestNotificationRecord/SettingsTab を shared からインポート"
```

---

### Task 11: 最終検証とクリーンアップ

**Files:** なし（検証のみ）

- [ ] **Step 1: lint を実行する**

```bash
npm run lint
```

期待結果: エラーなし（警告があれば `npm run lint:fix` で自動修正）

- [ ] **Step 2: 全テストを実行する**

```bash
npm test
```

期待結果: 全テスト PASS

- [ ] **Step 3: ビルドを実行する**

```bash
npm run build
```

期待結果: `out/` ディレクトリにビルド成果物が生成される（エラーなし）

- [ ] **Step 4: lint:fix が必要な場合はコミット**

lint 自動修正で変更が生じた場合のみ:
```bash
git add -p
git commit -m "style: lint 自動修正"
```
