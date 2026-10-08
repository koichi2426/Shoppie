# Shoppie の Supabase データ保存

会話履歴・会話の文脈・反応イベントを Supabase の PostgreSQL に保存する。画面は Vercel、FastAPI と Python 版 LangGraph は Render で動かす。会話履歴用の `DATABASE_URL` と、反応データ用の `INTERACTION_DATABASE_URL` は別の設定にする。

```mermaid
flowchart LR
    Browser[ブラウザ] -->|会話・クリック・リセット| API[Render / FastAPI]
    UI[Vercel / Next.js] --> Browser
    API -->|発話・返答・商品を保存| History[(会話履歴)]
    API -->|文脈を読み書き| Checkpoints[(チェックポイント)]
    API -->|別スレッドで INSERT| Events[(反応イベント)]
    subgraph Supabase[Supabase / PostgreSQL]
        History
        Checkpoints
        Events
    end
    API --> Logs[Render / 構造化ログ]
    Events --> Export[エクスポート・集計]
    History --> Analysis[返答・提案の分析]
```

## プロジェクトと接続

1. Supabase に Shoppie 用の Organization と Project を作成する。Free プランから始められる。リージョンは Render の地域に近いものを選ぶ。
2. GitHub 連携は不要。Data API と新しいテーブルの自動公開は無効にする。今回はバックエンドから PostgreSQL に直接接続する。
3. プロジェクト作成時の DB パスワードは手元の `.env` の `SUPABASE_DB_PASSWORD` に保管できる。この項目だけではバックエンドは接続しない。起動時はパスワードを含む `INTERACTION_DATABASE_URL` を使う。
4. Project の SQL Editor で [反応イベント](migrations/202610080001_interaction_events.sql)、[会話履歴](migrations/202610080002_conversation_turns.sql)の SQL を順番に実行する。`shoppie_analytics.interaction_events` を作る。`public` スキーマへ置かず、ブラウザ向けの権限・RLS ポリシーを付けない。
5. Project 上部の Connect から **Session pooler** の接続文字列を取得する。IPv4 で利用できる。パスワード中の予約文字は URL エンコードする。末尾に `?sslmode=require` を付ける（既存のクエリがある場合は `&sslmode=require`）。
6. Render の Environment に `INTERACTION_DATABASE_URL` と `DATABASE_URL`（同じ接続文字列）、`CONVERSATION_DB_SCHEMA=shoppie_checkpoints`、`CONVERSATION_IDLE_TTL_SECONDS=0` を追加し、バックエンドを再デプロイする。ローカルはリポジトリ直下の `.env`、または `fastapi/.env` に保存する。DB パスワード・接続文字列は Git に入れない。Vercel に DB 接続文字列を設定する必要はない。

```dotenv
# 実際のホスト・ユーザー名は Connect が表示したものを使う。
INTERACTION_DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require
```

SQL Editor の代わりに、リポジトリをチェックアウトした端末でマイグレーションを実行することもできる。

```bash
cd fastapi/backend
PYTHONPATH=. python scripts/migrate_interaction_events.py
```

接続とテーブルの確認は起動時に行う。設定済みなのに接続できない場合やテーブルがない場合は、起動を失敗させる。`INTERACTION_DATABASE_URL` が空欄の場合は従来のログ記録だけになる。

## 会話履歴と文脈

`shoppie_analytics.conversation_turns` に発話本文・返答本文・提案商品・成功/失敗・会話 ID・往復 ID・構成ハッシュを保存する。成功の返答は履歴の INSERT 完了後に返す。履歴 DB に保存できない場合は API を失敗させ、本文をログに退避しない。失敗したエージェントの入力も保存する。

会話を続けるための LangGraph チェックポイントは `shoppie_checkpoints` の非公開スキーマに置く。起動時に作成する。TTL が 0 のときアイドル削除を行わず、再起動後も同じ会話 ID で文脈を継続できる。会話リセットはチェックポイントを削除するが、分析用の `conversation_turns` は削除しない。履歴の自動削除は行わず、管理者が別途削除する。公開の履歴取得 API や画面の復元機能は追加していない。

```sql
SELECT occurred_at, context_id, turn_id, user_text, assistant_text, products, status
FROM shoppie_analytics.conversation_turns
ORDER BY occurred_at DESC
LIMIT 50;
```

発話本文を含む履歴は、反応イベントのエクスポートと分けて管理する。実利用者の履歴を公開 Git リポジトリに保存しない。

## 反応イベントの保存と確認

往復の成功・失敗、商品クリック、会話リセットを記録する。日時・イベント ID・会話 ID・往復 ID・構成ハッシュ・デプロイコミットに加え、商品数・モール別件数・処理時間・クリック順位・モール・価格を JSONB に持つ。発話本文・IP アドレスはイベントに保存しない。

API プロセス内の上限 1,000 件のキューと別スレッドで書き込み、接続プールの上限は 1 にする。標準出力には同じイベント ID・日時の JSON を残す。DB エラーやキュー満杯ではログに残して返答を継続する。イベント ID の重複 INSERT は無視する。ブラウザの再送を判別する ID は現在なく、同じクリックを再送した場合は別イベントとして保存される。

SQL Editor で直近の記録を確認できる。

```sql
SELECT occurred_at, event_type, turn_id, config_version, payload
FROM shoppie_analytics.interaction_events
ORDER BY occurred_at DESC
LIMIT 50;
```

集計は DB からエクスポートし、既存スクリプトを使う。エクスポートは発話本文を含まないが、利用者の反応データなので公開 Git リポジトリへそのままコミットしない。

```bash
cd fastapi/backend
PYTHONPATH=. python scripts/export_interaction_events.py > /tmp/shoppie-events.log
PYTHONPATH=. python scripts/aggregate_interaction_events.py /tmp/shoppie-events.log --json
# 開始日時を限定する場合
PYTHONPATH=. python scripts/export_interaction_events.py --since 2026-10-08T00:00:00+09:00
```

## 運用

- Free プランは DB 500 MB、1 週間利用がないと一時停止、自動バックアップなし。定期的なエクスポートで保管する。[料金・制限](https://supabase.com/pricing)
- キューは永続化しない。プロセスの強制終了・DB 障害では DB に保存されないイベントがあり、ログ保持期間内にログを回収する必要がある。正常終了では最大 10 秒待って書き込みを進める。
- `/healthz` は会話ストアの状態を確認する。反応 DB の起動後の障害では返答を続けるため、ヘルスチェックは成功しうる。`interaction database write failed` / `queue full` のログと直近の DB 記録で保存状態を確認する。
- 商品クリックは購入を示さない。「押さずに終了」は観測期間内に次の発話がない場合の候補であり、離脱を確定しない。比較時は構成ごとに同じ観測期間を取る。
- 発話本文を持たないため、言い直しと正当な絞り込みの区別はできない。反応の件数と率を集め、構成変更の前後を比較する。

接続方法は [Supabase 公式ドキュメント](https://supabase.com/docs/guides/database/connecting-to-postgres)、権限は [RLS の公式ドキュメント](https://supabase.com/docs/guides/database/postgres/row-level-security)を参照。
