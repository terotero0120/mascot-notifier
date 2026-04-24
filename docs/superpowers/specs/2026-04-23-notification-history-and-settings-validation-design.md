# 設計書: 通知履歴書き込み直列化 + 設定バリデーション

**日付:** 2026-04-23
**対象Issue:** #23（優先度1・2）

---

## 背景

GitHub Issue #23 のレビュー結果として以下の2点を対応する。

1. **通知履歴の非直列書き込み（Item 1）**: `flushAsync()` が `fs.promises.writeFile` を await せずキューイングもしていないため、複数の write が並走すると古いスナップショットが後から書き込まれて最新履歴が失われる。
2. **設定値のスキーマ検証欠如（Item 2）**: `characterFile` がファイルパス構築に使われているにもかかわらずバリデーションがなく、パストラバーサルのリスクがある。`displayDuration` や `displayPosition` の不正値も無検証で保存される。

---

## Item 1: 通知履歴書き込みの直列化 + Atomic write

### 変更ファイル
- `src/main/notificationHistory.ts`
- `src/main/index.ts`
- `src/renderer/src/SettingsApp.tsx`

### 設計

#### `src/main/notificationHistory.ts`

モジュールレベルに以下を追加する。

```typescript
let writeChain: Promise<void> = Promise.resolve();
let lastWriteError = false;
```

`flushAsync()` を以下のように変更する。

```typescript
function flushAsync(): void {
  const snapshot = JSON.stringify(cache ?? []);
  const target = getHistoryPath();
  const tmp = target + '.tmp';

  writeChain = writeChain
    .then(() => fs.promises.writeFile(tmp, snapshot))
    .then(() => fs.promises.rename(tmp, target))
    .then(() => { lastWriteError = false; })
    .catch((err) => {
      lastWriteError = true;
      console.error('Failed to save notification history:', err);
    });
}
```

`HistoryData` 型に `writeError: boolean` を追加する。

```typescript
export interface HistoryData {
  displayedIds: Set<string>;
  historyOnly: DisplayedEntry[];
  writeError: boolean;
}
```

`getHistoryData()` の戻り値に `writeError: lastWriteError` を追加する。

#### `src/main/index.ts`

`get-notification-history` ハンドラで `writeError` をレスポンスに含める。現在のフラット配列返しから以下に変更する。

```typescript
return {
  records: [...markedDbRecords, ...historyOnlyRecords].sort(...).slice(0, 30),
  writeError: writeError,
};
```

#### `src/renderer/src/electron.d.ts`

`getNotificationHistory` の戻り値型を更新する。

```typescript
getNotificationHistory: () => Promise<{ records: LatestNotificationRecord[]; writeError: boolean }>;
```

#### `src/renderer/src/SettingsApp.tsx`

`HistoryState` 型の `success` バリアントに `writeError` を追加する。

```typescript
type HistoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; records: LatestNotificationRecord[]; writeError: boolean }
  | { status: 'error'; message: string };
```

`getNotificationHistory()` の `.then()` を更新してレスポンス構造の変化に対応する。

```typescript
.then(({ records, writeError }) =>
  setHistoryState({ status: 'success', records, writeError })
)
```

`writeError` が `true` のとき、履歴リストの上部にバナーを表示する。

```
「履歴の保存に失敗しました」
```

### 動作保証

- `snapshot` は `flushAsync()` 呼び出し時点で文字列化するため、チェーン実行タイミングに関わらず最新状態を持つ
- `writeChain` によって前の write が完了してから次が始まるため、逆順完了による上書きが起きない
- `tmp → rename` で atomic write を実現し、書き込み途中のクラッシュで既存ファイルが壊れない
- エラーは `.catch` で吸収してチェーンが詰まらないようにする

---

## Item 2: 設定値のバリデーション

### 変更ファイル
- `src/main/settings.ts`
- `src/main/index.ts`
- `src/renderer/src/SettingsApp.tsx`

### 設計

#### `src/main/settings.ts`

`validateSettings(raw: unknown): AppSettings` 関数を追加する。

| フィールド | バリデーション | 不正時の挙動 |
|---|---|---|
| `characterFile` | `['dance.json', 'crab.json']` のみ許可 | `DEFAULT_SETTINGS.characterFile` にフォールバック |
| `displayDuration` | 数値 かつ `1000〜60000ms` の範囲内 | 範囲外は clamp、数値でなければデフォルト値 |
| `displayPosition` | `'top-right'` または `'bottom-right'` のみ | `DEFAULT_SETTINGS.displayPosition` にフォールバック |

`loadSettings()` — `JSON.parse` 後に `validateSettings()` を通す（起動時の壊れた設定を自動修復）。

`saveSettings(settings: AppSettings): void` — 保存前に `characterFile` が許可リストにない場合は `throw new Error('Invalid characterFile')` する。その他のフィールドは `validateSettings()` を通して正規化してから保存する。

#### `src/main/index.ts`

`ipcMain.handle` は `throw` を自動的に IPC エラーとして renderer に伝播するため、`save-settings` ハンドラへの追加実装は不要。

#### `src/renderer/src/SettingsApp.tsx`

- `saveError: string | null` の state を追加する
- `handleSave` を `try/catch` で囲み、エラー時に `saveError` をセットして設定フォーム内に表示する
- 保存成功時は `saveError` をクリアする

---

## テスト方針

- `notificationHistory.ts`: `addDisplayedNotification` を連続呼び出しして、`displayed-notifications.json` の最終状態が最新であることを検証するユニットテストを追加
- `settings.ts`: `validateSettings()` に対して各フィールドの境界値・不正値を網羅するユニットテストを追加

---

## スコープ外

- Item 3（プライバシー説明）、Item 4（型共通化）、Item 5（public suffix）、Item 6（CI）は本設計書の対象外
