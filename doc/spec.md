# mascot-notifier 仕様書

## 概要

デスクトップに常駐し、OS の通知をキャッチして独自キャラクターの吹き出しで表示するアプリ。
特定サービスの API に依存せず、OS レベルで通知を汎用的に取得する設計とする。

---

## 機能要件

### 通知表示
- OS の通知センターが受け取った通知を検知する
- 通知を検知したらキャラクターと吹き出しを画面右上に表示する
- 吹き出しには「送信者名」と「メッセージ本文」を表示する
- 表示から 5 秒後にフェードアウトして消える
- キャラクターは通知時のみ表示し、通常時は非表示

### 常駐
- アプリはバックグラウンドで常駐し続ける
- メニューバー（macOS）またはタスクトレイ（Windows）に常駐アイコンを表示する
- アプリ終了はメニューバー / タスクトレイから行う

---

## 非機能要件

- クロスプラットフォーム対応（まず macOS を実装し、後から Windows を追加）
- 通知ソースは Google Chat を想定するが、OS 通知全般に対応できる汎用設計とする

---

## 技術スタック

| 項目 | 採用技術 |
|------|----------|
| フレームワーク | Electron |
| 言語 | TypeScript |
| UI | React |
| ビルドツール | electron-vite |
| キャラクターアニメーション | Lottie (lottie-web) |
| DB 読み取り | better-sqlite3 |

---

## アーキテクチャ

```
Electron App
├── Main Process
│   ├── NotificationMonitor          # 通知監視の抽象レイヤー
│   │   └── MacOSNotificationMonitor # macOS実装
│   │       └── 通知センターDBをポーリング
│   │           ~/Library/Application Support/
│   │           com.apple.notificationcenter/db2/db
│   └── WindowManager                # オーバーレイウィンドウ制御
└── Renderer Process
    └── CharacterOverlay             # キャラクター + 吹き出しUI
```

### 通知取得方法（macOS）

- `~/Library/Application Support/com.apple.notificationcenter/db2/db` を `better-sqlite3` で定期ポーリング
- データ形式: Binary Plist (NSKeyedArchiver) のため、デコード処理が必要
- 必要権限: フルディスクアクセス（初回起動時にユーザーへ案内UIを表示）

### オーバーレイウィンドウ

- フレームレス・透明・常に最前面
- 表示位置: 画面右上
- クリックスルー対応（背後のウィンドウ操作を妨げない）

---

## キャラクター仕様

| 項目 | 内容 |
|------|------|
| 最終形式 | Lottie (.json) |
| 素材入手先 | LottieFiles.com など |
| 作成ツール | Figma + プラグイン / After Effects / Rive |
---

## 開発ステップ

| Step | 内容 |
|------|------|
| 1 | Electron プロジェクト作成・透明オーバーレイウィンドウを画面右上に表示 |
| 2 | キャラクター + 吹き出し UI 実装（ダミーデータで動作確認） |
| 3 | macOS 通知センター DB の読み取り実装 |
| 4 | 通知取得と UI を接続・5 秒フェードアウト実装 |
| 5 | フルディスクアクセス権限の案内 UI 追加 |
| 6 | Windows 対応（通知取得部分のみ別実装で差し込み） |

---

## 将来の拡張候補

- 通知フィルタリング（アプリ名・キーワード指定）
- キャラクターの差し替えUI
- 吹き出しデザインのカスタマイズ
- 通知音の設定
- Windows 対応
