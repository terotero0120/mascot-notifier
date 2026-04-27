# IPC/Renderer 型定義の src/shared/ 集約設計

Date: 2026-04-24
Issue: #26

## 背景・目的

`AppSettings`・`NotificationData`・`LatestNotificationRecord` などの型が main / preload / renderer の複数箇所に重複定義されており、フィールド追加・変更時にドリフトが起きやすい状態になっている。`src/shared/` に DTO と IPC チャンネル定義を集約し、型レベルでドリフトを防ぐ。

## 新規作成ファイル

### `src/shared/types.ts`

以下の型をすべて集約する：

| 型名 | 移動元 | 備考 |
|---|---|---|
| `AppSettings` | `src/main/settings.ts`、`src/renderer/src/electron.d.ts`（重複） | |
| `NotificationData` | `src/main/monitors/base.ts`、`src/renderer/src/CharacterOverlay.tsx`（重複） | |
| `LatestNotificationRecord` | `src/main/monitors/base.ts`、`src/renderer/src/electron.d.ts`（重複） | |
| `NotificationHistoryResponse` | `src/renderer/src/electron.d.ts`（inline）| `{ records: LatestNotificationRecord[]; writeError: boolean }` |
| `SettingsTab` | `src/main/index.ts`、`src/renderer/src/SettingsApp.tsx`（重複） | `'settings' \| 'history'` |
| `ElectronAPI` | `src/renderer/src/electron.d.ts` | preload/renderer 間の IPC 契約インターフェース |

### `src/shared/ipc-channels.ts`

IPC チャンネル名を定数オブジェクトに集約する：

```ts
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

## 変更ファイル

### tsconfig

- `tsconfig.node.json`: `include` に `"src/shared/**/*"` を追加
- `tsconfig.web.json`: `include` に `"src/shared/**/*"` を追加
- `tsconfig.shared.json` は作成しない（現状の 2 分割構成で include 追加で十分）

### `src/main/settings.ts`

- `AppSettings` インターフェース定義を削除
- `import type { AppSettings } from '../shared/types'` を追加

### `src/main/monitors/base.ts`

- `NotificationData`・`LatestNotificationRecord` インターフェース定義を削除
- `import type { NotificationData, LatestNotificationRecord } from '../../shared/types'` を追加

### `src/main/index.ts`

- `IPC_CHANNELS` を使用してチャンネル名文字列を置き換え
- `SettingsTab` 型を shared からインポート（ローカル定義を削除）

### `src/preload/index.ts`

- インライン型定義を削除し、shared からインポート
- `IPC_CHANNELS` を使用してチャンネル名文字列を置き換え

### `src/renderer/src/electron.d.ts`

- `AppSettings`・`LatestNotificationRecord`・`ElectronAPI` を削除
- `Window` 拡張のみ残す
- `import type` を追加するとモジュール扱いになるため、`declare global {}` でラップし `export {}` を追加する

```ts
import type { ElectronAPI } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
```

### `src/renderer/src/CharacterOverlay.tsx`

- ローカル `NotificationData` インターフェース定義を削除
- `import type { NotificationData, AppSettings } from '../../shared/types'` を追加（`AppSettings` は現在グローバルで使用中）

### `src/renderer/src/SettingsApp.tsx`

- `import type { AppSettings, LatestNotificationRecord, SettingsTab } from '../../shared/types'` を追加
- ローカルの `type Tab = 'settings' | 'history'` を削除し、`SettingsTab` を使用

## 変更しないもの

- `src/main/notificationHistory.ts` の `DisplayedEntry`・`HistoryData` は main 内部専用なので shared 化しない
- `src/main/monitors/windowsParser.ts` の `ParsedWindowsNotification` は monitors 内部専用
- `formatNotificationTimestamp` 関数は `src/main/monitors/base.ts` に残す（renderer からは使用しない）

## テスト・検証方針

- `npm run lint` でエラーがないことを確認
- `npm test` で既存テストが全通過することを確認
- `npm run build` でビルドが通ることを確認
