---
user_invocable: true
description: mainから新しいブランチを作成してコミット・pushする
---

# new-branch

現在の変更を main ベースの新しいブランチにコミットして push する。

## Steps

1. `git checkout main` で main に切り替える
2. `git pull` で main を最新化する
3. 変更内容（`git diff`）を確認し、変更の目的・種別から適切なブランチ名を自動生成する
   - 形式: `<type>/<short-description>` （例: `feat/debug-fetch-latest`, `fix/notification-parse-error`）
   - type は `feat` / `fix` / `refactor` / `chore` から選ぶ
4. `git checkout -b <ブランチ名>` で新しいブランチを作成する
5. 変更差分（`git diff HEAD` または `git stash` からの復元）を適用する
6. `npm run lint` を実行し、エラーがあれば修正する
7. 変更ファイルをステージして `git commit` する（コミットメッセージは変更内容から自動生成）
8. `git push -u origin <ブランチ名>` で push する
9. push 結果と PR 作成用 URL を表示する
