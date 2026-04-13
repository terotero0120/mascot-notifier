# 既知の問題と注意事項

## macOS 通知センター DB への依存

- Apple の非公開内部 DB を使用しており、macOS のアップデートでスキーマやパスが変更される可能性がある
- Ventura で実際にパスが変更された実績あり（`Application Support` → `Group Containers`）
- OS アップデート後に動作しなくなった場合は、DB パスとスキーマの確認が必要

## Windows 通知 DB への依存

- `wpndatabase.db` は Microsoft の非公開内部 DB であり、Windows のアップデートでスキーマが変更される可能性がある
- `Notification` テーブルの `Id`, `ArrivalTime`, `Payload`, `Type` カラムと `NotificationHandler` テーブルの `RecordId`, `PrimaryId` カラムに依存
- ブラウザの Web Notifications API 経由の通知は、デスクトップアプリ（PWA含む）から送信された場合のみ検出可能。ブラウザ内の通知は検出されない

## フルディスクアクセス（macOS）

- ユーザーに「フルディスクアクセス」を要求する必要がある
- App Store 配布ではフルディスクアクセス前提のアプリは審査で弾かれる可能性が高い
- 現時点では個人利用を前提としている

## ポーリング方式の制約

- 3 秒間隔のポーリングのため、通知の表示に最大 3 秒の遅延がある
- バッテリー消費への影響あり（ただしDBの読み取りのみなので軽微）
- 毎回DBを開閉するため若干のオーバーヘッドがあるが、システム所有のDBへのロック競合を避けるための意図的な設計

## eval('require') の使用

- `mac.ts` では `better-sqlite3` と `bplist-parser`、`windows.ts` では `better-sqlite3` のロードに `eval('require')` を使用
- ビルド時に Vite から警告が出るが、electron-vite の `ssr.noExternal: true` 強制を回避するための意図的な使用
- セキュリティ上のリスクは低い（ハードコードされたモジュール名のみ使用）

## Windows 向けクロスビルド

- macOS から `npm run dist:win` でクロスビルド可能だが、`better-sqlite3` のネイティブバイナリは `prebuild-install` で事前ダウンロードが必要
- electron-builder の `@electron/rebuild` はホストプラットフォーム向けにしかリビルドできないため、`-c.npmRebuild=false` で無効化している
- `WIN_ARCH` 環境変数でアーキテクチャを切り替え可能（デフォルト: `arm64`）
  - x64 向け: `npm run dist:win:x64` または `WIN_ARCH=x64 npm run dist:win`
  - arm64 向け: `npm run dist:win:arm64` または `npm run dist:win`

## OS 通知との共存（二重表示）

- このアプリは OS の通知を横取り・抑制しない（DB の読み取り専用アクセス）
- OS 標準の通知バナーとキャラクター吹き出しの両方が表示される
- アプリが停止しても OS 通知は影響を受けない

### 対処法

macOS の通知設定で対象アプリの「バナー」を OFF にすると二重表示を防げる。
Tray メニューの「通知設定を開く」から設定画面を開ける。
詳細は [セットアップガイド](setup.md) を参照。
