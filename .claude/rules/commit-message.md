---
description: コミットメッセージの書き方(必守・リポジトリ全体で適用。Claude がコミットするときも同じ)
---

# コミットメッセージ(必守)

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に沿う。type と scope は英語、**件名と本文は必ず日本語**で書く(英語の件名・本文にしない)。

## 形

```text
<type>(<scope>): <件名>

<本文: なぜ変えたか。何を変えたかは diff でわかるので書かなくてよい>

<フッター: BREAKING CHANGE、Refs など>
```

例:

```text
feat(agent): 予算の上限を言われたら価格で絞り込んで検索する

「1万円以内」などの発話を各モールの price_to に渡す。LLM に価格判定を
させると取りこぼしが出るため、ツールスキーマで構造化する。
```

```text
fix(frontend): Instagram 内ブラウザで音声入力が始まらない不具合を直す
```

## type

| type | 使うとき |
|---|---|
| `feat` | ユーザーから見える機能を追加・変更する |
| `fix` | 不具合を直す |
| `refactor` | 振る舞いを変えずにコードを整理する |
| `perf` | 性能を上げる |
| `test` | テストだけを追加・修正する |
| `docs` | ドキュメント・ADR・ルールだけを変える |
| `build` | ビルド設定・依存関係(package.json、requirements.txt、Dockerfile など)を変える |
| `ci` | CI の設定を変える |
| `chore` | 上のどれにも当たらない雑務(.gitignore など) |

## scope

変更したディレクトリで決める。複数にまたがるときは主なものを 1 つ選ぶか、省略する。

| scope | 対象 |
|---|---|
| `frontend` | `nextjs/frontend/` |
| `backend` | `fastapi/backend/`(下の `agent`・`mall` 以外) |
| `agent` | `fastapi/backend/infrastructure/gateways/langgraph/`(LangGraph エージェント・プロンプト) |
| `mall` | `fastapi/backend/infrastructure/gateways/{yahoo,rakuten,amazon}/`(モール API 連携) |
| `api` | `fastapi/openapi.json` とフロントの型生成(API の契約) |
| `adr` | `docs/adr/` |
| `claude` | `.claude/`・`CLAUDE.md` |

## 件名

- 50 文字以内を目安にする。末尾に句点をつけない
- 「〜する」の形で、このコミットを入れると何が起きるかを書く(「〜しました」「〜の修正」にしない)
- 何のための変更かわかる言葉にする(「修正」「更新」「WIP」だけにしない)

## 本文

- 件名だけで理由がわかるなら省略してよい
- 理由・背景・トレードオフ・関連する ADR を書く。1 行 72 文字前後で折り返す
- API の契約(`openapi.json` のリクエスト・レスポンスの形)を壊す変更は、フッターに `BREAKING CHANGE: <何が変わるか>` を書く

## コミットの単位

- 1 コミット = 1 つの論理的な変更。無関係な変更を混ぜない(整形だけの変更は分ける)
- API の変更は、バックエンド・`openapi.json`・フロントの型生成(`npm run gen`)・フロントの実装を同じ PR に入れる。コミットは分けてもよい
- テストが通る状態でコミットする

## Claude がコミットするとき

- ユーザーに頼まれたときだけコミットする。`main` にいるならブランチを切ってから
- 上の形に従う。件名は diff を読んでから書く
- 末尾に Claude Code の指示どおりの `Co-Authored-By:` 行をつける
- 秘密情報(`.env`、`.env.local`、API キーなど)を含めない。`git add -A` ではなくファイルを指定して add する
- `--no-verify` でフックを飛ばさない。`--amend` や force push はユーザーに頼まれたときだけ
