---
user_invocable: true
description: mainから新しいブランチを作成してコミット・pushする
---

# new-branch

現在の変更を main ベースの新しいブランチにコミットして push する。

## Steps

1. 変更内容（`git diff` + `git status`）を確認し、変更の目的・種別から適切なブランチ名を自動生成する
   - 形式: `<type>/<short-description>` （例: `feat/debug-fetch-latest`, `fix/notification-parse-error`）
   - type は `feat` / `fix` / `refactor` / `chore` から選ぶ
2. 未コミット変更がある場合のみ `git stash push -u` で退避する（クリーンな作業ツリーならスキップ）
3. `git checkout main` で main に切り替える
4. `git pull` で main を最新化する
5. `git checkout -b <ブランチ名>` で新しいブランチを作成する
6. Step 2 でスタッシュした場合は `git stash pop` で変更を復元する
7. `npm run lint` を実行し、エラーがあれば修正する
8. 変更ファイルをステージして `git commit` する（コミットメッセージは変更内容から自動生成）
9. `git push -u origin <ブランチ名>` で push する
10. push 結果と PR 作成用 URL を表示する
