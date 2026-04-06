# アーキテクチャ

## プロセス構成

```
Electron App
├── Main Process (src/main/)
│   ├── index.ts                  # アプリ起動・ウィンドウ管理・Tray制御
│   └── notificationMonitor.ts    # 通知センターDBポーリング
├── Preload (src/preload/)
│   └── index.ts                  # IPC ブリッジ (contextBridge)
└── Renderer Process (src/renderer/)
    ├── index.html
    └── src/
        ├── main.tsx              # React エントリポイント
        └── CharacterOverlay.tsx  # キャラクター + 吹き出し UI
```

## 通知取得の仕組み（macOS）

### DB パス

| macOS バージョン | パス |
|---|---|
| Ventura 以降 | `~/Library/Group Containers/group.com.apple.usernoted/db2/db` |
| それ以前 | `~/Library/Application Support/com.apple.notificationcenter/db2/db` |

アプリは新しいパスを優先し、存在しない場合にレガシーパスへフォールバックする。

### ポーリング

- 3 秒間隔で SQLite DB を読み取り専用で開く
- `record` テーブルから `delivered_date` が前回チェック以降のレコードを取得
- `rec_id` を Set で管理し、同一通知の重複表示を防止（上限 500 件で古いものを破棄）

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

## オーバーレイウィンドウ

| 設定 | 値 | 理由 |
|---|---|---|
| `frame` | `false` | ウィンドウ枠を非表示 |
| `transparent` | `true` | 背景を透明に |
| `alwaysOnTop` | `'screen-saver'` レベル | 全ウィンドウの上に表示 |
| `focusable` | `false` | フォーカスを奪わない |
| `setIgnoreMouseEvents` | `true, { forward: true }` | クリックスルー対応 |
| `visibleOnAllWorkspaces` | `true, { visibleOnFullScreen: true }` | 全デスクトップ + フルスクリーンで表示 |

## IPC 通信

```
Main Process --[notification]--> Preload --[electronAPI.onNotification]--> Renderer
```

一方向のみ。Renderer から Main への通信は不要。

## ネイティブモジュールの取り扱い

`better-sqlite3` は C++ ネイティブアドオン。electron-vite は内部で `ssr.noExternal: true` を強制し全モジュールをバンドルしようとするが、ネイティブモジュールはバンドルできない。

**回避策**: `eval('require')` でバンドラーの静的解析を回避し、ランタイムで Node.js の `require` を使ってロードする。

```typescript
const nativeRequire = eval('require') as NodeRequire
const Database = nativeRequire('better-sqlite3')
```
