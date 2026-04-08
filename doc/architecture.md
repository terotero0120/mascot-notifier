# アーキテクチャ

## プロセス構成

```
Electron App
├── Main Process (src/main/)
│   ├── index.ts                  # アプリ起動・ウィンドウ管理・Tray制御・ファイルログ
│   ├── notificationMonitor.ts    # プラットフォーム別モニターのファクトリ（遅延読み込み）
│   ├── settings.ts               # 設定の永続化
│   └── monitors/
│       ├── base.ts               # BaseNotificationMonitor（共通ロジック）
│       ├── mac.ts                # macOS通知監視
│       └── windows.ts            # Windows通知監視
├── Preload (src/preload/)
│   └── index.ts                  # IPC ブリッジ (contextBridge)
└── Renderer Process (src/renderer/)
    ├── index.html
    └── src/
        ├── main.tsx              # React エントリポイント（ハッシュルーティング）
        ├── CharacterOverlay.tsx   # キャラクター + 吹き出し UI
        └── SettingsApp.tsx        # 設定画面 UI
```

## 通知監視の共通設計

`BaseNotificationMonitor`（`monitors/base.ts`）が共通ロジックを提供：

- `seenIds: Set<number>` — 通知IDの重複排除（上限500件で古いものを破棄）
- `emitStartedOnce()` — 初回ポーリング成功時に `'started'` イベントを1回だけ発火
- `emitPermissionErrorOnce()` — 権限エラー時に `'permission-error'` を1回だけ発火
- `trimSeenCache()` — `seenIds` が500件を超えたら古いエントリを削除（ゼロアロケーション）

`notificationMonitor.ts` は `process.platform` に応じてモジュールを **遅延読み込み** する。これにより、macOS上でWindows用のネイティブモジュールをロードする問題を回避。

## 通知取得の仕組み（macOS）

### DB パス

| macOS バージョン | パス |
|---|---|
| Ventura 以降 | `~/Library/Group Containers/group.com.apple.usernoted/db2/db` |
| それ以前 | `~/Library/Application Support/com.apple.notificationcenter/db2/db` |

アプリは新しいパスを優先し、存在しない場合にレガシーパスへフォールバックする。

### ポーリング

- 3 秒間隔で SQLite DB を `better-sqlite3` で読み取り専用で開く
- `record` テーブルから `delivered_date` が前回チェック以降のレコードを取得
- `seenIds`（基底クラス）で同一通知の重複表示を防止

### タイムスタンプ

macOS Core Data のエポックは **2001-01-01**（Unix エポックとの差分: 978307200 秒）。

```
Core Data timestamp = Unix timestamp - 978307200
```

### 通知データのパース

DB の `data` カラムは Binary Plist (bplist) 形式。`bplist-parser` でデコードすると以下の構造：

```json
{
  "app": "com.tinyspeck.slackmacgap",
  "req": {
    "titl": "送信者名",
    "body": "メッセージ本文"
  },
  "date": 797146807.475
}
```

- `req.titl` → 送信者名
- `req.body` → メッセージ本文（文字列 or 配列）
- `app` → バンドル ID（送信者名のフォールバック）

## 通知取得の仕組み（Windows）

### DB パス

```
%LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db
```

### ポーリング

- 3 秒間隔で SQLite DB を `better-sqlite3` で読み取り専用で開く
- `Notification` テーブルから `ArrivalTime` が起動時刻以降、`Type = 'toast'` のレコードを取得
- `NotificationHandler` テーブルとJOINしてアプリ名（`PrimaryId`）を取得

### タイムスタンプ

Windows FILETIME 形式: **1601-01-01** 起点、100ナノ秒単位。

```
FILETIME = (Unix seconds + 11644473600) × 10,000,000
```

### 通知データのパース

`Payload` カラムはXML形式のトースト通知。`<text>` 要素を正規表現で抽出：

```xml
<toast>
  <visual>
    <binding>
      <text>送信者名</text>
      <text>メッセージ本文</text>
    </binding>
  </visual>
</toast>
```

- 1番目の `<text>` → 送信者名
- 2番目の `<text>` → メッセージ本文
- `<text>` が1つの場合は `PrimaryId` から送信者名を推定

### WAL モード

`wpndatabase.db` は SQLite の WAL (Write-Ahead Log) モードで運用される。`better-sqlite3` はWALを正しく読めるため、最新の通知データを確実に取得できる。

> sql.js (WASM) は DB ファイルをバッファとして読み込むため WAL 内のデータを読めない。これが `better-sqlite3` を採用した理由。

## オーバーレイウィンドウ

| 設定 | 値 | 理由 |
|---|---|---|
| `frame` | `false` | ウィンドウ枠を非表示 |
| `transparent` | `true` | 背景を透明に |
| `alwaysOnTop` | `'screen-saver'` レベル | 全ウィンドウの上に表示 |
| `focusable` | `false` | フォーカスを奪わない |
| `setIgnoreMouseEvents` | `true, { forward: true }` | クリックスルー対応 |
| `visibleOnAllWorkspaces` | `true` (macOSのみ) | 全デスクトップ + フルスクリーンで表示 |

## IPC 通信

```
Main Process --[notification]--> Preload --[electronAPI.onNotification]--> Renderer
Main Process --[settings-changed]--> Preload --[electronAPI.onSettingsChanged]--> Renderer
Renderer --[get-settings / save-settings]--> Preload --[ipcMain.handle]--> Main Process
```

## ネイティブモジュールの取り扱い

`better-sqlite3` は C++ ネイティブアドオン。electron-vite は内部で `ssr.noExternal: true` を強制し全モジュールをバンドルしようとするが、ネイティブモジュールはバンドルできない。

**回避策**: `eval('require')` でバンドラーの静的解析を回避し、ランタイムで Node.js の `require` を使ってロードする。

```typescript
const nativeRequire = eval('require') as NodeRequire
const Database = nativeRequire('better-sqlite3')
```

## ファイルログ

Windows またはenv `LOG_TO_FILE` が設定されている場合、`console.log/warn/error` をインターセプトして `%APPDATA%/mascot-notifier/app.log` にも出力する。アプリ終了時にストリームをクローズ。

## トレイアイコン

プラットフォームに応じて切り替え：
- **macOS**: `iconTemplate.png`（テンプレートイメージとしてダークモード対応）
- **Windows**: `icon-win.png`（通常アイコン）
