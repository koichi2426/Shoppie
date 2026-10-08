# ADR-0015: 会話チェックポイントを PostgreSQL で共有する

- ステータス: 採用（ローカルとAWSのRDS・Fargateで検証済み）
- 日付: 2026-10-08
- 関連: [T-0002](../trials/0002-KEY-conversation-state.md)、[T-0017](../trials/0017-KEY-traffic-capacity.md)
- 置き換え: [ADR-0006](0006-session-memorysaver.md) の単一プロセス前提

## 背景

API を ALB の後ろで複数台に増やすには、どの API に届いても同じ会話状態を取得する必要がある。
MemorySaver はプロセスごとに独立しており、最終アクセスの記録も共有されない。

## 決定

- LangGraph の PostgresSaver を使う。開発では Compose の PostgreSQL、AWS 検証では RDS PostgreSQL を使う。
- 会話 ID と最終アクセスを同じ DB に記録する。180秒のアイドル TTL を維持し、60秒ごとに削除する。
- PostgreSQL の advisory lock で同じ会話の実行と削除を排他する。実行中は掃除を行わない。
- スキーマ初期化も排他する。待機側は `pg_try_advisory_lock` を繰り返し、CONCURRENTLY のインデックス作成を待機トランザクションが妨げないようにする。
- `DATABASE_URL` または `DATABASE_SECRET_ARN` の設定で PostgreSQL を選ぶ。未設定時は単一プロセス用の MemorySaver を使う。
- LangGraph は PostgresSaver と互換性のある0.5.4へ更新する。PostgresSaver は2.0.25。

## 代替案

| 案 | 見送った理由 |
|---|---|
| Redis checkpointer | PostgreSQL で共有・排他・期限管理を一つにまとめられるため、今回の実装では採用しない |
| ALB の sticky session + MemorySaver | 再起動・入れ替え時に履歴が消える。会話状態が各 API のメモリに依存し続ける |
| 会話ごとに自作 JSON を保存 | LangGraph の checkpoint と中間書き込みの保存機構を再実装する必要がある |

## 影響と限界

DB 接続・マイグレーション・バックアップの運用が増える。設定済み DB が利用できなければ起動は失敗し、MemorySaver へ自動退避しない。
同じ会話のロックを15秒以内に取得できなければ、その処理は失敗する。異なる会話は並列に実行する。
DB 保存はフロントの履歴復元画面を追加するものではなく、TTL を過ぎた会話は引き続き削除する。
AWS の RDS 接続とALB配下の2タスクによる会話の継続を確認した（[レポート](../reports/20261008_aws-traffic-capacity.md)）。
RDS の実際のパスワードローテーションとAWSでのタスク入れ替えはまだ検証していない。
