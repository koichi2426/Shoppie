---
description: 新しい PR は専用の git worktree で作業する(必守・リポジトリ全体で適用。並行作業のため)
---

# PR ごとに worktree を切る(必守)

新しく PR を作るときは、**専用の git worktree を切って作業する**。理由は並行作業のため。複数の Claude セッション・サブエージェント・人間が、別々の PR を同時に、お互いの作業ツリーを壊さずに進められるようにする。

## ルール

- **1 PR = 1 worktree = 1 ブランチ**。ブランチは必ず最新の `origin/main` から切る
- メインのチェックアウトで PR の開発をしない(メインは `main` を追従するだけの場所にする)
- worktree は `.claude/worktrees/<name>/` に置く(`.gitignore` 済み)

## 切り方

| 方法 | 使うとき |
|---|---|
| `EnterWorktree` ツール | 自分のセッションで新しい PR を始めるとき。`.claude/worktrees/<name>` に作られる |
| サブエージェントの worktree 分離(`isolation: "worktree"`) | 独立したタスクを並列に進めるとき。タスクごとにエージェントを起動する |
| 手動 | `git fetch origin main` のあと `git worktree add .claude/worktrees/<name> -b <branch> origin/main` |

ブランチ名はこのリポジトリの命名に直す(自動で付く `worktree-...` のままにしない)。`<type>/<内容>` の形で、type は [commit-message.md](commit-message.md) の type に合わせる。

```sh
git branch -m feat/price-filter
```

例: `feat/price-filter`、`fix/instagram-voice-input`、`docs/claude-setup`、`refactor/agent-tool-schema`

## 作業の分け方

| 状況 | やり方 |
|---|---|
| 互いに独立したタスク | worktree・PR を分けて並列に進める |
| 同じファイルを触る、または一方がもう一方に依存する | 同じ PR にまとめるか、順番に進める(先の PR のマージ後に次を切る) |

PR は小さく保つ。大きな変更は、独立して入れられる単位に分けて並列化する。

## worktree での注意

- メインのチェックアウトに `cd` したり `git -C` で操作したりしない。自分の worktree の中だけで作業する
- **git stash は全 worktree で共有**される。素の `git stash` / `git stash pop` は使わない。作業を退避するなら WIP コミットにする
- 他のセッションの worktree を消さない。何のための worktree かわからないものは触らない
- worktree を消すのは、その PR がマージされたか破棄されたあと。`git worktree remove <path>` で消し、`git worktree prune` で残骸を掃除する

## PR を出す

- ブランチを push し、`gh pr create --base main` で作る
- タイトルと本文は日本語。本文の末尾に次の行をつける

```text
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- オーナーの OK なしにマージしない
