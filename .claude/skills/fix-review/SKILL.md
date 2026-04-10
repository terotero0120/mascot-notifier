---
user_invocable: true
description: PRのレビュー指摘コメントを取得して修正対応し、simplifyを実行後にコミット・pushしてPRにコメントする
---

# fix-review

指定したPR番号のレビュー指摘コメントを取得し、コードを修正してコミット・pushし、PRに対応内容をコメントする。

## 引数

- PR番号（例: `/fix-review 12`）

## Steps

1. 以下を並列で取得する
   - PRのブランチ名: `gh pr view <PR番号> --json headRefName`
   - リポジトリ名: `gh repo view --json nameWithOwner --jq .nameWithOwner`
2. PRのブランチに切り替える
   - `git fetch origin <headRefName>`
   - ローカルにブランチが存在しない場合: `git switch --track -c <headRefName> origin/<headRefName>`
   - ローカルにブランチが存在する場合: `git switch <headRefName>` → `git pull`
3. レビュー指摘を3種類並列で取得する
   - PRコメント: `gh pr view <PR番号> --json comments`
   - レビュー本文: `gh api repos/<owner>/<repo>/pulls/<PR番号>/reviews`
   - インラインコメント: `gh api repos/<owner>/<repo>/pulls/<PR番号>/comments`
4. 取得した JSON を統合して分析し、各指摘に対応するコードを修正する
5. `/simplify` スキルを実行して変更コードを整理する
6. `npm run lint` を実行し、エラーがあれば修正する
7. 変更ファイルをステージして commit する
   - コミットメッセージ: `fix: PRレビュー指摘対応 - <主な変更内容の要約>`
8. `git push origin <headRefName>` で push する
9. `gh pr comment <PR番号>` で対応内容をコメントする
   - コメントには各指摘への対応内容を箇条書きでまとめる
