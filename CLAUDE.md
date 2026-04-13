# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

macOSの通知センターを監視し、透明なオーバーレイウィンドウでアニメーション付きマスコットキャラクターと共に通知を表示するデスクトップアプリ。Electron + React + TypeScript で構築。

## コマンド

```bash
npm run dev           # ホットリロード付き開発サーバー
npm run build         # プロダクションビルド（./out/ に出力）
npm run preview       # ビルド済みアプリのプレビュー
npm test              # vitest（1回実行）
npm run test:watch    # vitest（ウォッチモード）
npm run lint          # Biomeによるlint + formatチェック
npm run lint:fix      # lint + format自動修正
npm run format        # フォーマットのみ自動修正
npm install           # 依存関係インストール + ネイティブモジュール再ビルド（better-sqlite3）
```

### ディストリビューション

- Windows用ビルドを求められたら `/dist-win` スキルを使うこと
- macOS用ビルドを求められたら `/dist-mac` スキルを使うこと

## アーキテクチャ

Electronの3プロセス構成：

- **Mainプロセス** (`src/main/index.ts`): アプリライフサイクル、ウィンドウ管理、システムトレイ、通知監視
- **Preload** (`src/preload/index.ts`): コンテキスト分離されたIPCブリッジ。`window.electronAPI` を公開
- **Renderer** (`src/renderer/src/main.tsx`): ハッシュベースルーティングのReactアプリ — ハッシュなしで `CharacterOverlay`、`#settings` で `SettingsApp` を表示

### 通知パイプライン

`createNotificationMonitor()` (`src/main/notificationMonitor.ts`) が `process.platform` に応じて `MacNotificationMonitor` または `WindowsNotificationMonitor` のインスタンスを返すファクトリ。各モニターは3秒ごとにSQLite DBをポーリングし、`rec_id` / `Id` で重複排除してIPCでRendererに送信する。オーバーレイウィンドウはフレームなし・透明・最前面・クリックスルー。

### 実装上の重要ポイント

- **ネイティブモジュール読み込み**: `better-sqlite3` はViteのバンドルを回避するため `eval('require')` を使用
- **macOS DBパス**: Ventura以降（`~/Library/Group Containers/group.com.apple.usernoted/db2/db`）とレガシーパスの両方に対応
- **Core Dataタイムスタンプ**: エポックオフセット 978307200（2001-01-01起点）で日付変換
- **設定**: `app.getPath('userData')/settings.json` にJSON保存、IPCでRendererと同期
- **オーバーレイウィンドウ**: 300x280px、スクリーンセーバーレベルのZオーダー、`setIgnoreMouseEvents(true, { forward: true })`
- **アニメーション**: Lottie JSONファイル（dance.json, crab.json）を `lottie-react` で描画

### ビルド設定

`electron-vite.config.ts` で3つのビルドターゲットを設定：mainとpreloadは `externalizeDepsPlugin()` を使用、rendererはVite Reactプラグインを使用。TypeScript設定は `tsconfig.node.json`（main/preload用）と `tsconfig.web.json`（renderer用）に分離。

## ドキュメント

詳細な仕様・アーキテクチャドキュメントは `doc/` 配下（spec.md, architecture.md, setup.md, known-issues.md）。
