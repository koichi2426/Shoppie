# T-0017: 多くの人が同時に話しかけても、待たせずに返せるか

- 状態: 継続中
- 試行回数: 4(うち失敗・破棄 0)
- 関連 ADR: [ADR-0005](../adr/0005-llm-bedrock-claude-haiku.md)、[ADR-0006](../adr/0006-session-memorysaver.md)、[ADR-0010](../adr/0010-hosting-vercel-render-cloudflare.md)
- 関連: [T-0002](0002-KEY-conversation-state.md)、[T-0014](0014-hosting.md)

## 問いの背景
会話 UI では 1 往復の待ち時間が体験を左右する。利用者が増えたときに、待ち時間・エラー・費用がどう変わるかは、まだ測っていない。
T-0002 は会話の状態をどこに持つか、T-0014 はどこに配信するかを扱う。この問いでは、同時に何件のリクエストを処理できるかを扱う。

## 試行
| 回 | 日付 | やったこと | 結果 | 判定 | 分かったこと | 次 | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | 2026-10-08 | API のコードを読み、同時処理の上限になる箇所を洗い出した(負荷はかけていない) | `async def run_agent` の中で、同期の `graph_app.stream()` を別スレッドに逃がさずに呼んでいる。Gunicorn は 1 ワーカー。Bedrock のスロットリング時のリトライは `time.sleep`。アプリ側のレート制限は無い | 未判定 | Bedrock とモール API を待つ間もイベントループが止まるので、同時に処理できるのは実質 1 リクエストと見込まれる。ワーカーを増やすには、先に MemorySaver を外部ストアへ移す必要がある(T-0002) | 負荷試験で同時接続数ごとの待ち時間を測り、グラフの実行を別スレッドに移した前後を比べる | 13e25d3 時点の `fastapi/backend/infrastructure/gateways/langgraph/langgraph_agent.py`・`fastapi/backend/Dockerfile` |
| 2 | 2026-10-08 | `run_agent` のグラフ実行を `asyncio.to_thread` で別スレッドに移し、Bedrock とモール API を一定時間待つ偽物にして、同時 1・3・10・30 人で変更前後の応答時間を測った | 最後の人の待ち時間は、変更前が 10 人で 35.30 秒・30 人で 105.94 秒、変更後が 10 人で 3.56 秒・30 人で 10.63 秒。1 人のときはどちらも 3.53 秒 | 成功 | 変更前はリクエストが 1 件ずつ処理されていた(待ち時間 = 人数 × 1 往復)。変更後はスレッドの上限(計測環境で 12)までは 1 往復の時間で返り、それを超えた分は空きを待つ。本番のスレッドの上限と、外部サービスのクォータは測っていない | 本番でのスレッドの上限、Bedrock のスロットリング、モール API の 429 を確かめる | c94e1c4、[レポート](../reports/20261008_agent-concurrency.md)([HTML](../reports/20261008_agent-concurrency.html)) |
| 3 | 2026-10-08 | PostgreSQL の会話ストアを共有し、1プロセスと2プロセスに同時1・10・30件を送って応答時間を比べた | 同時30件の最大は1プロセス10.913秒・2プロセス7.204秒。計246件が全件成功 | 成功 | 各プロセスのスレッド上限を超える負荷では、API のプロセス数を増やす効果があった。クライアントによる交互送信であり ALB は使っていない | ALB・Fargate・RDS で1タスクと2タスクを比較する | [レポート](../reports/20261008_shared-conversation-postgres.md)([HTML](../reports/20261008_shared-conversation-postgres.html)) |
| 4 | 2026-10-08 | 東京の ALB・Fargate・RDS で1台と2台に同時1・3・10・30・60件を各3回送った | 計624件が全件成功。同時60件の最大は35.869秒→18.127秒。異なる2タスクで同じ会話が続いた | 成功 | タスクごとのスレッド上限は6。模擬的な外部API待ちでは台数追加で処理待ちが短くなる | HTTPSと実APIでクォータ・エラー・費用を測る | [レポート](../reports/20261008_aws-traffic-capacity.md)([HTML](../reports/20261008_aws-traffic-capacity.html)) |

## 実験レポート

| 日付 | レポート | 関わる回 |
|---|---|---|
| 2026-10-08 | グラフの実行を別スレッドに移すと、同時に話しかけられたときの待ち時間は変わるか([Markdown](../reports/20261008_agent-concurrency.md) / [HTML](../reports/20261008_agent-concurrency.html)) | 2 |
| 2026-10-08 | PostgreSQL の共有会話と1・2プロセスの負荷比較([Markdown](../reports/20261008_shared-conversation-postgres.md) / [HTML](../reports/20261008_shared-conversation-postgres.html)) | 3 |

| 2026-10-08 | AWS の ALB・Fargate・RDS で1台と2台を比較([Markdown](../reports/20261008_aws-traffic-capacity.md) / [HTML](../reports/20261008_aws-traffic-capacity.html)) | 4 |

## いまの結論
グラフの別スレッド実行で、1ワーカー内の直列処理を解消した。PostgreSQL の共有保存で、別 API へ振り分けても会話を続けられる。
偽物の外部サービスによるローカル計測では、同時30件の最大待ち時間が1プロセス10.913秒から2プロセス7.204秒へ短くなった。
AWS の ALB・Fargate・RDS でも会話の共有と負荷分散を確認した。各タスク6スレッドで、同時60件の最大は1台35.869秒・2台18.127秒、624件が全件成功。
検証用AWSリソースは測定後に削除した。Bedrock・モールAPIの制限、実APIの待ち時間・費用はまだ測っていない。
