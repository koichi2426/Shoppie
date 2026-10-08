# Supabase の会話履歴・文脈の永続化

- 日付: 2026-10-08
- 記録: T-0002 回15・16、T-0016 回4
- 関連: [ADR-0017](../adr/0017-supabase-interaction-events.md)

## 結論

発話・返答・提案商品を非公開の `shoppie_analytics.conversation_turns` に保存する処理を追加した。成功の返答は履歴の保存完了後に返す。会話の文脈は非公開の `shoppie_checkpoints` に保存し、TTL 0 でアイドル削除を無効にできる。リセットは文脈を削除するが、分析用履歴は残す。

実際の Supabase で、記録処理を再起動して会話を継続し、リセット後も履歴が残ることを確認した。Render の環境変数変更・本番の会話はまだ検証していない。

## 条件

| 項目 | 条件 |
|---|---|
| 実行端末 | macOS、Python 3.12.2 |
| 実 DB | Supabase / PostgreSQL 17.11、Sydney（ap-southeast-2） |
| 接続 | Session pooler / 5432、sslmode=require |
| 文脈 | LangGraph PostgresSaver 2.0.25、LangGraph 0.5.4、非公開スキーマ |
| TTL | 0（アイドル削除なし） |
| 検証入力 | 人工発話 2 件、固定返答 OK。実利用者のデータなし |
| 外部 API | Bedrock・モール API への実リクエストなし |
| 回帰テスト DB | Docker / PostgreSQL 16.15、ケースごとの使い捨て DB |

## 結果

| 確認 | 結果 |
|---|---|
| Supabase 接続・マイグレーション | 接続し、反応イベント・会話履歴のテーブルを作成 |
| 反応イベントの保存・読み出し | 人工イベント 1 件を DB に保存・エクスポートし、検証後に削除 |
| チェックポイント再起動 | 同じ会話 ID の 2 往復目で 4 メッセージを取得 |
| TTL 0 の掃除 | 削除 0 件 |
| リセット後の分析用履歴 | 2 往復の行を保持 |
| 検証データの片付け | 人工会話のチェックポイント・履歴行を削除 |
| バックエンドの回帰テスト | 67 件通過、既知の収集エラー 2 ファイルを除外 |
| 履歴保存に失敗した返答 | 返答を成功として返さず、例外を返す |
| エージェントが失敗した入力 | failed の履歴として保存する経路を確認 |

最初の回帰テストは 65 件通過・1 件失敗だった。新しいテストが Presenter の応答をトップレベルの `message` として読んでいたが、実際は `response.message` だった。テストの参照を修正し、保存した発話・返答・商品が API の応答と一致することを確認した。保存実装の値は変更していない。

## 使ったデータ

- [Supabase の検証結果](data/20261008_conversation-history/supabase-verification.json)
- [再現用スクリプト](data/20261008_conversation-history/verify_supabase.py)
- [ローカルテストの結果](data/20261008_conversation-history/local-tests.json)
- [HTML の確認](data/20261008_conversation-history/html-check.json)

DB パスワード・接続文字列・実利用者の発話は記録に含めていない。

## 限界

検証は端末から Supabase に接続し、固定のグラフで行った。Render からの接続、本番の Bedrock・商品検索を伴う往復、サービス全体の負荷試験ではない。現在のページに過去の履歴を復元する UI や、公開の履歴取得 API は追加していない。

会話履歴は返答前に保存するが、途中でプロセスが強制終了した場合の未完了入力を全件保存する保証はない。反応イベントは従来どおりメモリ上のキューで書くので、履歴と保存保証が異なる。発話本文は別テーブルで管理し、反応ログや公開 Git へコピーしない。

履歴の自動削除は行わない。リセットは会話の文脈を消す操作であり、分析用の履歴を消す操作ではない。DB 容量やバックアップは別途運用する。

## 再現手順

バックエンドの開発依存を入れ、Supabase に 2 つの SQL マイグレーションを順番に適用する。手元の `.env` に `INTERACTION_DATABASE_URL` を設定する。接続文字列・パスワードは公開しない。

```bash
pip install -r fastapi/backend/requirements-dev.txt
PYTHONPATH=fastapi/backend python docs/reports/data/20261008_conversation-history/verify_supabase.py
```

Render の環境変数には次を設定して再デプロイする。

```dotenv
DATABASE_URL=SupabaseのSession pooler接続文字列（sslmode=require）
INTERACTION_DATABASE_URL=同じ接続文字列
CONVERSATION_DB_SCHEMA=shoppie_checkpoints
CONVERSATION_IDLE_TTL_SECONDS=0
```

ローカル回帰テストは使い捨て PostgreSQL を用意し、`TEST_DATABASE_URL` と `TEST_INTERACTION_DATABASE_URL` に接続先を設定して行う。実 DB をテスト用に指定しない。

```bash
cd fastapi/backend
DATABASE_URL='' INTERACTION_DATABASE_URL='' CONVERSATION_DB_SCHEMA='' \
CONVERSATION_IDLE_TTL_SECONDS=180 AWS_EC2_METADATA_DISABLED=true \
AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=testing AWS_SECRET_ACCESS_KEY=testing \
PYTHONPATH=. python -m pytest domain usecase infrastructure scripts/test_aggregate_interaction_events.py \
  --ignore=infrastructure/gateways/rakuten/test_rakuten_api.py \
  --ignore=infrastructure/gateways/yahoo/test_yahoo_api.py -q
```

HTML は `python scripts/render_experiment_report.py docs/reports/20261008_conversation-history.md` で再生成する。

## 出典

- [Supabase: 接続方法](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [保存と運用の手順](../../infra/supabase/README.md)
- 実装: `fastapi/backend/domain/services/conversation_history.py`、`usecase/request_assistance.py`、`infrastructure/gateways/interaction_log/postgres_event_recorder.py`、`infrastructure/gateways/langgraph/conversation_store.py`
