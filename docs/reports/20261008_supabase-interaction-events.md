# Supabase 向け反応イベント保存のローカル検証

- 日付: 2026-10-08
- 記録: T-0016 回2・回3
- 構成: [ADR-0017](../adr/0017-supabase-interaction-events.md)

## 結論

反応イベントを PostgreSQL に保存し、記録処理を再起動したあともエクスポート・既存の集計スクリプトで読むことを確認した。バックエンドのテストは、既知の収集エラーがある 2 ファイルを除いて 65 件通過した。Supabase のプロジェクト接続・Render の本番設定・本番の反応指標はまだ検証していない。

## 条件

| 項目 | 条件 |
|---|---|
| 実行環境 | macOS、Python 3.12.2 |
| DB | Docker の PostgreSQL 16.15、使い捨てローカル DB |
| 接続先 | 127.0.0.1:55433、TLS なし（本番は TLS を設定） |
| 保存先 | `shoppie_analytics.interaction_events` |
| キュー・接続数 | キュー上限 1,000 件、書き込みスレッド 1、DB 接続上限 1 |
| 入力 | 人工的な往復成功 1 件、商品クリック 1 件、会話リセット 1 件。実利用者のデータなし |
| 外部 API | Bedrock・モール API への実リクエストなし |

テストでは CREATEDB 権限のある使い捨て PostgreSQL に、ケースごとの DB を作成してマイグレーションを適用した。各 DB はケース終了時に削除した。

## 結果

| 確認 | 結果 |
|---|---|
| バックエンドの回帰テスト | 65 件通過。既知の収集エラー 2 ファイルを除外 |
| 最終 SQL 更新後の反応記録テスト | 8 件通過 |
| 記録処理の再起動後に読むイベント数 | 人工イベント 3 件を保持 |
| 既存集計との互換性 | 商品あり往復 1 件、クリック率 1.0、リセット率 1.0（人工データ） |
| マイグレーションの再実行・イベント ID の重複 INSERT | 既存の 3 件を保持、同一 ID の追加行なし |
| DB のテーブルを削除したとき | 書き込みエラーを記録し、同じイベントは標準出力に残った |
| 非オーナーロールのアクセス | SELECT・INSERT を拒否 |
| テーブル未作成での起動 | エラーになり、接続文字列・パスワードを例外に含めない |
| キュー満杯 | 追加書き込みを待たずログに残す |
| `/events` の text/plain POST | 204。アプリ正常終了後に DB から 1 件読み出し可能 |

初回のイベントテストは、マイグレーションのパスが worktree の親を参照していたため 5 件が fixture エラーになり、5 件だけ通過した。パスを修正した後、同じイベント・集計テスト 10 件が通過した。回帰テストでは既存の楽天・Yahoo テストがトップレベルモジュールを import して収集に失敗するため、その 2 ファイルを除外した。変更した保存処理のテストは除外していない。

人工データのクリック率は集計処理の確認値であり、提案の質を示す本番指標ではない。

## データ

- [検証結果 JSON](data/20261008_supabase-interaction-events/verification.json)
- [人工イベント JSON](data/20261008_supabase-interaction-events/synthetic-events.json)
- [HTML 確認結果](data/20261008_supabase-interaction-events/html-check.json)

## 限界

Supabase の Session pooler・TLS・無料枠の休止からの復帰、Render とのネットワーク遅延はまだ測っていない。処理の再起動で確認したのは DB が保持したデータの読み出しであり、メモリ上のキューの復旧ではない。キューは永続化しないため、強制終了や DB 障害時に DB 保存されないイベントがある。標準出力の回収が必要になる。

発話本文は反応イベントに保存しない。クリックは購入を示さず、クリックのない次の発話が言い直しか絞り込みかは区別できない。ブラウザ再送・不正送信による指標の汚染も今回の検証では扱っていない。

## 再現手順

使い捨て PostgreSQL を用意し、ローカル環境にバックエンドの開発依存を入れる。テスト用 DB には CREATEDB 権限が必要。以下の接続文字列はローカル検証だけのもの。

```bash
cd fastapi/backend
pip install -r requirements-dev.txt
export TEST_INTERACTION_DATABASE_URL=postgresql://shoppie:local-events-only@127.0.0.1:55433/events
export TEST_DATABASE_URL="$TEST_INTERACTION_DATABASE_URL"
export AWS_EC2_METADATA_DISABLED=true
export AWS_DEFAULT_REGION=us-east-1
export AWS_ACCESS_KEY_ID=testing
export AWS_SECRET_ACCESS_KEY=testing
PYTHONPATH=. python -m pytest domain usecase infrastructure scripts/test_aggregate_interaction_events.py \
  --ignore=infrastructure/gateways/rakuten/test_rakuten_api.py \
  --ignore=infrastructure/gateways/yahoo/test_yahoo_api.py -q
```

実 DB に反映する手順は [Supabase README](../../infra/supabase/README.md)に記載する。`INTERACTION_DATABASE_URL` を設定し、`scripts/migrate_interaction_events.py` でテーブルを作り、`scripts/export_interaction_events.py` の出力を `scripts/aggregate_interaction_events.py` に渡す。

HTML は以下で再生成する。

```bash
pip install -r scripts/requirements-report.txt
python scripts/render_experiment_report.py docs/reports/20261008_supabase-interaction-events.md
```

## 出典

- [Supabase: 接続方法・Session pooler・TLS](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Free プランの容量・休止・バックアップ](https://supabase.com/pricing)
- 実装: `fastapi/backend/infrastructure/gateways/interaction_log/postgres_event_recorder.py`
- テスト: `fastapi/backend/infrastructure/gateways/interaction_log/test_postgres_event_recorder.py`
