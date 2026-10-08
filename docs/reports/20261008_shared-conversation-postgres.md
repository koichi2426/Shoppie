# PostgreSQL に会話を保存すると、複数 API で会話を続けて負荷を分散できるか

- 日付: 2026-10-08
- 記録: [T-0002](../trials/0002-KEY-conversation-state.md) 回12・13、[T-0017](../trials/0017-KEY-traffic-capacity.md) 回3
- 実行: Codex
- HTML版: [同名のHTML](20261008_shared-conversation-postgres.html)

## 結論

ローカルの2つの API プロセスで会話を引き継げた。PostgresSaver のチェックポイントと最終アクセスを共有し、同じ会話の実行・削除には共通のロックを使った。
Docker の API コンテナを再起動しても、同じ会話の2往復目を処理できた。

一定時間待つ偽物の外部サービスで、同時30件の最大待ち時間は1プロセスの10.913秒から2プロセスの7.204秒へ短くなった。
各構成123件、計246件の負荷試験リクエストは全件成功した。
AWS の ALB・Fargate・RDS での負荷分散、実 API の性能・クォータ・費用はまだ測っていない。

## 条件

| 項目 | 条件 |
|---|---|
| ソース | 基点コミット `67d45eb7daaec0ae6c3f9944ddd30f53f1d92fe8` に今回の変更を適用した作業ツリー。ソースの SHA256 は protocol.json |
| 保存先 | Docker の PostgreSQL 16.15。LangGraph PostgresSaver 2.0.25 |
| API | macOS、Python 3.12.2、LangGraph 0.5.4、uvicorn 各1プロセス |
| スレッド | ホスト8コア。各プロセスの asyncio executor は既定12スレッド |
| DB接続 | 各 API にチェックポイント用最大8接続、会話ロック用最大32接続のプール |
| 外部サービス | LLM は1回1秒、1往復で2回。モール3つは各1.5秒で並列。実 API は呼ばない |
| 入力 | 「1万円以内のイヤホン」。負荷試験では毎回異なる新規会話 ID。共有履歴試験では同一 ID で2往復 |
| 負荷 | 同時1・10・30件、各3回。各回は全員がそろってから一斉に1リクエスト送信 |
| 振り分け | 1プロセスは localhost:8765。2プロセスはクライアントが8765と8766へ交互に送信。ALB は使っていない |
| 集計 | 各人数の3回分を合わせ、リクエストごとの応答時間の中央値・nearest-rank p95・最大を算出 |
| 保持期間 | 最終アクセスから180秒。開始・終了時に更新し、60秒ごとに掃除する |
| 再起動試験 | Python 3.10 の Docker イメージを別途起動し、1往復後にコンテナを再起動して2往復目を送信 |

## 結果

![APIプロセス数と同時リクエスト数ごとの最大応答時間](data/20261008_shared-conversation-postgres/figure.png)

単位は秒。リクエスト数は各構成の数。

| 同時件数 | リクエスト数 | 1プロセス中央値 | 1プロセスp95 | 1プロセス最大 | 2プロセス中央値 | 2プロセスp95 | 2プロセス最大 | 成功 |
|---|---|---|---|---|---|---|---|---|
| 1 | 3 | 3.555 | 3.555 | 3.555 | 3.555 | 3.562 | 3.562 | 全件 |
| 10 | 30 | 3.594 | 3.613 | 3.615 | 3.590 | 3.607 | 3.607 | 全件 |
| 30 | 90 | 7.193 | 10.896 | 10.913 | 3.615 | 7.199 | 7.204 | 全件 |

### 会話の継続と競合

- 共有履歴: 1往復目と2往復目が異なる API に届き、偽物の応答にある往復数が1から2へ進んだ。
- 再起動: Docker コンテナを再起動しても、2往復目の応答を得た。その後の会話削除も成功した。
- テスト: 既存のドメイン・ユースケース・LLM 入力整形と、新規の保存・競合テストを合わせて40件通過した。実モール API を呼ぶ既存テストは実行していない。
- PostgreSQL のテストは、履歴共有、保存機構の再接続、同じ会話への同時入力、処理中の掃除除外、実行と削除の排他、新規 DB への同時起動を含む。
- Secrets Manager の値を新規接続ごとに取得することは偽物で確認した。RDS の実際のローテーションは試していない。

### 初期化が止まった試行

最初はスキーマ初期化の待機側で `pg_advisory_lock` を呼んだ。
新規インデックスの `CREATE INDEX CONCURRENTLY` が、ロックを待っている別接続のトランザクションを待ち、初期化が進まなくなった。
`pg_stat_activity` ではインデックス作成が `virtualxid`、別接続が `advisory` を待っていた。
待機側を `pg_try_advisory_lock` の繰り返しへ変更した後、空の新規 DB に2つの保存機構を同時起動するテストが通過した。

## 分かったことと限界

同じ会話 ID で共通の DB を読むことで、API のプロセス内メモリに依存せず会話を続けられる。
プロセス数を増やすと利用できる executor のスレッドが増え、今回の30件同時では待ち時間が短くなったと考えられる。
10件同時では両構成とも約3.6秒で、プロセス数を増やした効果はほとんどない。

今回の2プロセスは同じホストで動き、クライアントが均等に振り分けている。別ホスト間の通信、ALB の振り分け、Fargate の CPU 割り当て、RDS の負荷は含まない。
各人数3回だけの短いバーストであり、p95 はこの少数標本の記述値。持続負荷や本番の応答時間を保証しない。
LLM・モールは偽物なので、スロットリング、429、リトライによる遅延、外部サービスの費用は含まない。
実行中の会話を削除しない設計のため、外部サービスが長時間停止した場合には会話がTTLより長く残り得る。

## AWS への次の手順

[infra/aws](../../infra/aws/README.md) に ALB・ECS Fargate・RDS の Terraform と、1タスク・2タスクの試験手順を用意した。
Terraform validate と、mock provider による構成テスト3件は通過した。
AWS 認証が InvalidClientTokenId で失敗しており、実アカウントの plan/apply は未実施。
次は AWS にログインし、同じイメージ・設定で台数だけを変えて比較する。その後、HTTPS と実 API の条件で段階的に負荷を増やす。

## 使ったデータと出典

| 種類 | 場所 |
|---|---|
| 測定条件・ソース識別 | [protocol.json](data/20261008_shared-conversation-postgres/protocol.json) |
| 1プロセスのリクエスト結果 | [one-process.json](data/20261008_shared-conversation-postgres/one-process.json) |
| 2プロセスのリクエスト結果 | [two-processes.json](data/20261008_shared-conversation-postgres/two-processes.json) |
| 共有履歴の HTTP 試験 | [session-check.json](data/20261008_shared-conversation-postgres/session-check.json) |
| コンテナ再起動 | [container-restart.json](data/20261008_shared-conversation-postgres/container-restart.json) |
| 集計値・図の再生成 | [summary.json](data/20261008_shared-conversation-postgres/summary.json)、[analyze.py](data/20261008_shared-conversation-postgres/analyze.py) |
| 保存機構・テスト | [conversation_store.py](../../fastapi/backend/infrastructure/gateways/langgraph/conversation_store.py)、[test_conversation_store.py](../../fastapi/backend/infrastructure/gateways/langgraph/test_conversation_store.py) |
| 負荷の送受信 | [load_test_server.py](../../fastapi/backend/scripts/load_test_server.py)、[load_test_client.py](../../fastapi/backend/scripts/load_test_client.py) |
| HTML のブラウザ確認 | [html-check.json](data/20261008_shared-conversation-postgres/html-check.json) |
| AWS の構成テスト | [validation.tftest.hcl](../../infra/aws/tests/validation.tftest.hcl) |

入力は合成の発話で、会話 ID と本番の発話はデータに保存していない。API の識別には local-api-1 / local-api-2 を使う。

## 再現手順

リポジトリルートで依存を入れ、DB を起動する。PostgreSQL の統合テストには、使い捨ての DB と CREATEDB 権限を使う。

```sh
python3 -m venv /tmp/shoppie-checkpoints
/tmp/shoppie-checkpoints/bin/pip install -r fastapi/backend/requirements-dev.txt matplotlib mistune
docker compose -f fastapi/docker-compose.yml up -d db
export DATABASE_URL=postgresql://shoppie:local-development-only@127.0.0.1:5432/shoppie
export TEST_DATABASE_URL="$DATABASE_URL"
export PYTHONPATH=fastapi/backend
/tmp/shoppie-checkpoints/bin/pytest -q   fastapi/backend/infrastructure/gateways/langgraph/test_conversation_store.py   fastapi/backend/infrastructure/gateways/langgraph/test_llm_context_log.py   fastapi/backend/infrastructure/gateways/langgraph/test_tool_result_summary.py   fastapi/backend/domain/test_domain_objects.py fastapi/backend/usecase/test_usecases.py
SHOPPIE_INSTANCE_ID=local-api-1 /tmp/shoppie-checkpoints/bin/python fastapi/backend/scripts/load_test_server.py --port 8765 &
SHOPPIE_INSTANCE_ID=local-api-2 /tmp/shoppie-checkpoints/bin/python fastapi/backend/scripts/load_test_server.py --port 8766 &
```

両方の /healthz が200になった後、以下を順番に実行する。

```sh
SHOPPIE_DATA=docs/reports/data/20261008_shared-conversation-postgres
/tmp/shoppie-checkpoints/bin/python fastapi/backend/scripts/load_test_client.py   --urls http://127.0.0.1:8765 http://127.0.0.1:8766 --session-check --min-instances 2   --label shared --out "$SHOPPIE_DATA/session-check.json"
/tmp/shoppie-checkpoints/bin/python fastapi/backend/scripts/load_test_client.py   --url http://127.0.0.1:8765 --concurrency 1 10 30 --rounds 3   --label one-process --out "$SHOPPIE_DATA/one-process.json"
/tmp/shoppie-checkpoints/bin/python fastapi/backend/scripts/load_test_client.py   --urls http://127.0.0.1:8765 http://127.0.0.1:8766 --concurrency 1 10 30 --rounds 3   --label two-processes --out "$SHOPPIE_DATA/two-processes.json"
/tmp/shoppie-checkpoints/bin/python "$SHOPPIE_DATA/analyze.py"
/tmp/shoppie-checkpoints/bin/python scripts/render_experiment_report.py docs/reports/20261008_shared-conversation-postgres.md
```

再起動試験は Python 3.10 の Dockerfile からイメージを作り、同じ DB に接続した偽物の API を起動する。
同一 context_id で1往復送信した後、API コンテナだけを docker restart し、同じ ID で次の発話を送る。
偽物の応答が「会話の往復: 2」になることと、DELETE /context/{context_id} が deleted=true を返すことを確認する。
AWS 構成は `terraform -chdir=infra/aws init -backend=false`、`terraform -chdir=infra/aws validate`、`terraform -chdir=infra/aws test` で検証する。mock provider の試験は実際の AWS リソースを作らない。
