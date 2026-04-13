---
user_invocable: true
description: Windows用ディストリビューションをビルドする
---

# dist-win

Windows用のディストリビューションをビルドする。

## アーキテクチャの指定

- デフォルトは `arm64`
- x64 向けにビルドする場合は `npm run dist:win:x64`（または `WIN_ARCH=x64 npm run dist:win`）を使用する

## Steps

1. ユーザーがアーキテクチャを指定している場合は対応するコマンドを選択する（指定なし → `npm run dist:win`、x64 → `npm run dist:win:x64`、arm64 → `npm run dist:win:arm64`）
2. 選択したコマンドを実行する
3. ビルド結果の `dist/` ディレクトリから生成された `.exe` ファイルのパスとサイズを表示する
