# セットアップガイド

## 前提条件

- Node.js v20 以上
- macOS（現時点で macOS のみ対応）

## インストール

```bash
npm install
```

`postinstall` で `electron-rebuild` が自動実行され、`better-sqlite3` が Electron 用にネイティブビルドされる。

## 開発

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## macOS フルディスクアクセスの設定

通知センター DB の読み取りにフルディスクアクセス権限が必要。

1. `システム設定` > `プライバシーとセキュリティ` > `フルディスクアクセス`
2. 以下を追加して許可：
   - 開発時：使用しているターミナルアプリ（Terminal.app / cmux 等）
   - 開発時：`node_modules/electron/dist/Electron.app`
3. 追加後、ターミナルと Electron を再起動

権限がない場合、アプリ起動時にダイアログで設定を案内する。

## macOS 通知バナーの無効化（推奨）

このアプリは OS 通知を独自 UI で表示するため、OS 標準の通知バナーと二重表示になる。
対象アプリの通知バナーを無効化すると、mascot-notifier の吹き出しのみ表示される。

1. `システム設定` > `通知` を開く（Tray メニューの「通知設定を開く」からも開ける）
2. 通知を mascot-notifier のみで表示したいアプリを選択
3. 「通知を許可」は ON のまま、「バナー」を OFF にする

これにより DB には通知が記録され mascot-notifier で表示されるが、OS バナーは表示されなくなる。

## Lottie キャラクターの設定

キャラクターアニメーション用の Lottie JSON ファイルを以下に配置：

```
src/renderer/public/character.json
```

- [LottieFiles.com](https://lottiefiles.com/) 等から `.json` 形式でダウンロード可能
