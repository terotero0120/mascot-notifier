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

## Lottie キャラクターの設定

キャラクターアニメーション用の Lottie JSON ファイルを以下に配置：

```
src/renderer/public/character.json
```

- [LottieFiles.com](https://lottiefiles.com/) 等から `.json` 形式でダウンロード可能
