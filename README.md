# Mascot Notifier

デスクトップに常駐し、OSの通知をキャッチしてアニメーション付きマスコットキャラクターの吹き出しで表示するアプリ。

Electron + React + TypeScript で構築。macOS / Windows 対応。

## 機能

- **通知の検知と表示** — OS の通知センターを監視し、通知を検知するとマスコットキャラクターと吹き出しで画面に表示
- **常駐動作** — メニューバー（macOS）/ タスクトレイ（Windows）に常駐し、バックグラウンドで動作
- **キャラクターアニメーション** — Lottie JSON ファイルによるアニメーション付きキャラクター表示。設定画面から切り替え可能
- **表示時間の設定** — 吹き出しの表示秒数をカスタマイズ可能（デフォルト5秒）
- **クリックスルー対応** — オーバーレイウィンドウは透明・最前面表示で、背面のウィンドウ操作を妨げない

## 対応プラットフォーム

| プラットフォーム | 通知取得方式 |
|---|---|
| macOS | 通知センター SQLite DB ポーリング |
| Windows | wpndatabase.db SQLite DB ポーリング |

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Electron |
| 言語 | TypeScript |
| UI | React |
| ビルドツール | electron-vite |
| パッケージング | electron-builder |
| アニメーション | Lottie (lottie-react) |
| DB 読み取り | better-sqlite3 |
| Linter / Formatter | Biome |

## セットアップ

### 前提条件

- Node.js v20 以上
- macOS または Windows

### インストール

```bash
git clone https://github.com/<your-username>/mascot-notifier.git
cd mascot-notifier
npm install
```

`postinstall` で `electron-rebuild` が自動実行され、`better-sqlite3` が Electron 用にネイティブビルドされます。

### macOS: フルディスクアクセスの設定

通知センター DB の読み取りにフルディスクアクセス権限が必要です。

1. **システム設定** > **プライバシーとセキュリティ** > **フルディスクアクセス** を開く
2. 以下を追加して許可：
   - 開発時：使用しているターミナルアプリ（Terminal.app / iTerm2 等）
   - 開発時：`node_modules/electron/dist/Electron.app`
3. 追加後、ターミナルと Electron を再起動

### Windows: 通知アクセス

特別な権限設定は不要です。`wpndatabase.db` はユーザーディレクトリ内にあり、通常のアプリから読み取り可能です。

## 開発

```bash
npm run dev        # ホットリロード付き開発サーバー
npm run build      # プロダクションビルド（./out/ に出力）
npm run preview    # ビルド済みアプリのプレビュー
```

### Lint / Format

```bash
npm run lint       # Biome による lint + format チェック
npm run lint:fix   # lint + format 自動修正
npm run format     # フォーマットのみ自動修正
```

## 配布用ビルド

> **注意**: 配布用ビルドは **macOS 上でのみ実行可能**です。ビルドスクリプトは POSIX シェル構文（`${VAR:-default}`、`VAR=value npm run ...`）を使用しており、Windows の cmd / PowerShell では動作しません。

```bash
npm run dist:mac        # macOS 配布用 (.dmg)
npm run dist:win        # Windows 配布用 arm64 (.exe, NSIS インストーラー)
npm run dist:win:x64    # Windows 配布用 x64
npm run dist:win:arm64  # Windows 配布用 arm64（dist:win と同じ）
```

アーキテクチャは `WIN_ARCH` 環境変数でも指定できます：

```bash
WIN_ARCH=x64 npm run dist:win
```

### macOS からの Windows クロスビルド

`npm run dist:win` は以下を自動的に行います：

1. `electron-vite build` でアプリをビルド
2. `prebuild-install` で Windows 用の `better-sqlite3` プリビルドバイナリをダウンロード
3. `electron-builder --win` でパッケージング
4. ビルド後、macOS 用の `better-sqlite3` バイナリを復元

出力先: `dist/mascot-notifier-setup-x.x.x.exe`

## プロジェクト構成

```
mascot-notifier/
├── src/
│   ├── main/                      # Main プロセス
│   │   ├── index.ts               # アプリ起動・ウィンドウ管理・Tray 制御
│   │   ├── notificationMonitor.ts # プラットフォーム別モニターのファクトリ
│   │   ├── settings.ts            # 設定の永続化
│   │   └── monitors/
│   │       ├── base.ts            # 共通ロジック（重複排除等）
│   │       ├── mac.ts             # macOS 通知監視
│   │       └── windows.ts         # Windows 通知監視
│   ├── preload/
│   │   └── index.ts               # IPC ブリッジ (contextBridge)
│   └── renderer/
│       └── src/
│           ├── main.tsx            # React エントリポイント
│           ├── CharacterOverlay.tsx # キャラクター + 吹き出し UI
│           └── SettingsApp.tsx     # 設定画面 UI
├── resources/                     # アイコン等のリソース
├── doc/                           # 詳細仕様・設計ドキュメント
└── electron-vite.config.ts        # ビルド設定
```

## キャラクターのカスタマイズ

Lottie JSON ファイルを `src/renderer/public/` に配置し、設定画面から選択できます。

[LottieFiles.com](https://lottiefiles.com/) 等から `.json` 形式でダウンロードして利用可能です。

## OS 通知との共存について

このアプリは OS の通知を読み取り専用で参照するため、OS 標準の通知バナーとマスコット吹き出しの両方が表示されます。二重表示を防ぐには、macOS の通知設定で対象アプリの「バナー」を OFF にしてください（トレイメニューの「通知設定を開く」から設定可能）。

## ログ

```
# Windows（自動出力）
%APPDATA%\mascot-notifier\app.log

# macOS（環境変数 LOG_TO_FILE=1 で有効化）
~/Library/Application Support/mascot-notifier/app.log
```

## 通知履歴

表示した通知は端末上のファイルに保存されます。

| 項目 | 内容 |
|------|------|
| 保存先 | `%APPDATA%\mascot-notifier\displayed-notifications.json`（Windows） / `~/Library/Application Support/mascot-notifier/displayed-notifications.json`（macOS） |
| 保存内容 | 送信者・通知本文・アプリ名を**平文**で保存 |
| 最大保持件数 | 200件（超過分は古いものから削除） |
| 削除方法 | `displayed-notifications.json` を直接削除してください |

## ライセンス

MIT
