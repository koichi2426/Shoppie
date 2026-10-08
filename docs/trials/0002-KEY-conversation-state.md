# T-0002: 会話の文脈と履歴を、どこに・いつまで持つか

- 状態: 継続中(Supabaseで文脈再開と会話履歴保持を検証済み)
- 試行回数: 16(うち失敗・破棄 6)
- 関連 ADR: [ADR-0006](../adr/0006-session-memorysaver.md)
- 関連: [T-0001](0001-KEY-search-or-chat-screen.md)、[T-0003](0003-KEY-llm-context.md)

## 問いの背景
店員と話すように、前の発話を踏まえて会話を続けたい。ログインはさせない。DB を持つと運用が増える。

## 試行
| 回 | 日付 | やったこと | 結果 | 判定 | 分かったこと | 次 | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | 2025-06-12 | コンテキスト ID を Cookie に持たせ、文脈を保つ | いまも Cookie の ID でスレッドを引いている | 成功 | — | — | dcfa254 |
| 2 | 2026-06-30 | セッション ID を UUID にし、`/admin` で全会話の閲覧・削除をできるようにする | — | 破棄(回8) | — | — | dc0a408 |
| 3 | 2026-06-30 | `/admin` の二重認証(`ADMIN_PASSWORD`・`ADMIN_API_KEY`)をやめ、ログインなしにする | 全会話の閲覧・削除がログインなしでできる状態になった | 破棄(回8) | — | — | d8bd26a |
| 4 | 2026-06-30 | 履歴を localStorage に永続化する(バックエンドからの復元も) | — | 破棄(回5) | — | バックエンドから取る | 3042acd |
| 5 | 2026-06-30 | localStorage をやめ、履歴はバックエンドの API から取る | — | 部分 | — | サーバー側で永続化する | 103e810 |
| 6 | 2026-06-30 | 履歴を SQLite に永続化し、Gunicorn を 1 ワーカーにする | — | 破棄(回8) | 複数ワーカーではセッションが消え、turns 数が食い違った | — | 584ba59 |
| 7 | 2026-06-30 | ローカルで足した発言と API で取った発言の二重登録をやめる | — | 成功(回8で履歴表示ごと不要に) | 2 つの経路で同じ発言を足していた | — | 4a77bfb |
| 8 | 2026-07-01 | SQLite・admin API・履歴ドロワーをやめ、LangGraph のメモリと画面表示は今のセッションだけにする | 現行の構成 | 成功 | 会話は短命でよい(ADR-0006) | 使われないスレッドを消す | 923d060 |
| 9 | 2026-07-01 | 3 分使われていないスレッドのメモリを 60 秒ごとに消す | `THREAD_IDLE_TTL_SECONDS = 180` | 成功 | — | — | b1d96ce |
| 10 | 2026-07-01 | 「新しい会話」ボタンで文脈を消す | — | 成功 | — | 消す前に確認する | 53ae3c2 |
| 11 | 2026-07-01 | 新しい会話の前に削除を確認する | — | 成功 | — | — | 1df5eb6 |
| 12 | 2026-10-08 | PostgresSaver の初期化を複数接続で同時に実行し、スキーマ更新を advisory lock で排他した | CREATE INDEX CONCURRENTLY が virtualxid を待ち、別接続は advisory lock を待って初期化が進まなかった | 失敗 | ブロックするロック取得のクエリ自体が、インデックス作成の待ち対象になった | 待機側を pg_try_advisory_lock の繰り返しにする | [レポート](../reports/20261008_shared-conversation-postgres.md)([HTML](../reports/20261008_shared-conversation-postgres.html)) |
| 13 | 2026-10-08 | チェックポイントと最終アクセスを PostgreSQL へ移し、会話の実行・削除・掃除を共通のロックで制御した | 2つの API で同じ会話を継続でき、Docker API の再起動後も2往復目を処理できた。同時送信・掃除・削除と新規 DB の同時初期化を検証した | 成功 | 会話状態と期限を共有すれば、API プロセスを増やせる。DB 未設定時は MemorySaver を使う | AWS の RDS と Fargate で接続と会話の継続を測る | [レポート](../reports/20261008_shared-conversation-postgres.md)([HTML](../reports/20261008_shared-conversation-postgres.html))、[ADR-0015](../adr/0015-shared-postgres-checkpoints.md) |
| 14 | 2026-10-08 | RDS 管理シークレットを ECS タスクロールで取得し、ALB 配下の2タスクから同じ会話を処理した | 異なる2タスクで1往復目→2往復目が継続。RDS PostgreSQL18.3のヘルスチェックと負荷処理が成功 | 成功 | RDS とAWSの権限設定でも会話を共有できた | 実パスワードローテーションとタスク入れ替えを検証する | [レポート](../reports/20261008_aws-traffic-capacity.md)([HTML](../reports/20261008_aws-traffic-capacity.html)) |
| 15 | 2026-10-08 | 会話の発話・返答・商品を別テーブルへ保存する処理を追加し、回帰テストを実行した | 65 件通過・1 件失敗。新テストが Presenter 応答の message をトップレベルから読んでいた | 失敗 | 保存実装と API の比較に入る前に、テストが応答の階層を誤っていた | response.message として比較するよう修正した（回16） | [レポート](../reports/20261008_conversation-history.md)（[HTML](../reports/20261008_conversation-history.html)） |
| 16 | 2026-10-08 | 会話履歴の保存と非公開チェックポイントを Supabase で検証し、TTL 0 でアイドル削除を無効にした | バックエンド 67 件通過（既知の収集エラー 2 ファイルを除外）。Supabase で再起動後に 4 メッセージを取得し、リセット後も分析用履歴 2 件を保持。人工データは削除 | 部分 | 文脈の再開と履歴保持を分けられた。Render の本番接続はまだ検証していない | Render の環境変数を設定して本番の往復を確認する | [ADR-0017](../adr/0017-supabase-interaction-events.md)、[レポート](../reports/20261008_conversation-history.md)（[HTML](../reports/20261008_conversation-history.html)） |

## 実験レポート

| 日付 | レポート | 関わる回 |
|---|---|---|
| 2026-10-08 | PostgreSQL に会話を保存すると、複数 API で会話を続けて負荷を分散できるか([Markdown](../reports/20261008_shared-conversation-postgres.md) / [HTML](../reports/20261008_shared-conversation-postgres.html)) | 12・13 |
| 2026-10-08 | AWS の ALB・Fargate・RDS で会話を共有([Markdown](../reports/20261008_aws-traffic-capacity.md) / [HTML](../reports/20261008_aws-traffic-capacity.html)) | 14 |
| 2026-10-08 | Supabase の会話履歴・文脈の永続化（[Markdown](../reports/20261008_conversation-history.md) / [HTML](../reports/20261008_conversation-history.html)） | 15・16 |

## いまの結論
PostgreSQL 設定時は、チェックポイントと最終アクセスを共通 DB に保存する。会話の実行・削除は DB のロックで排他し、処理中の会話を掃除しない。
ローカルの複数 API と API コンテナの再起動で会話の継続を確認した。180秒のアイドル TTL は維持する。
DB 未設定時は従来の MemorySaver を使い、単一プロセスが前提となる。現在の本番 Render の配置は変更していない。
AWS の RDS 接続とALB配下の2タスクで会話の継続を確認した。検証リソースは測定後に削除した。
RDS の実パスワードローテーションとAWSでのタスク入れ替えはまだ検証していない。

Supabase では非公開スキーマに文脈を保存し、TTL 0 でアイドル削除を無効にできる。分析用履歴は返答前に別テーブルへ保存し、会話リセットで削除しない。Supabaseで検証済みだが、Render の接続設定はまだ実施していない。
