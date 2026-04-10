---
user_invocable: true
description: PRのレビュー指摘コメントを取得して修正対応し、simplifyを実行後にコミット・pushしてPRにコメントする
---

# fix-review

指定したPR番号のレビュー指摘コメントを取得し、コードを修正してコミット・pushし、PRに対応内容をコメントする。

## 引数

- PR番号（例: `/fix-review 12`）

## Steps

1. `gh pr view <PR番号> --json headRefName,baseRefName` でブランチ名を取得する
2. PRのブランチに切り替える: `git checkout <headRefName>` → `git pull origin <headRefName>`
3. レビューコメントを2種類並列で取得する
   - 概要コメント: `gh pr view <PR番号> --comments`
   - インラインコメント: `gh api repos/<owner>/<repo>/pulls/<PR番号>/comments`
   - `<owner>/<repo>` は `git remote get-url origin` のURLから取得する
4. 取得したコメントの内容を分析し、各指摘に対応するコードを修正する
5. `/simplify` を実行して変更コードを整理する
6. `npm run lint` を実行し、エラーがあれば修正する
7. 変更ファイルをステージして commit する
   - コミットメッセージ: `fix: PRレビュー指摘対応 - <主な変更内容の要約>`
8. `git push origin <headRefName>` で push する
9. `gh pr comment <PR番号> --repo <owner>/<repo>` で対応内容をコメントする
   - コメントには各指摘への対応内容を箇条書きでまとめる
