# ADR-0015: API の AWS 検証環境を ALB・ECS Fargate・RDS で構成する

- ステータス: 採用（AWSで模擬負荷を検証し、検証リソースを削除済み）
- 日付: 2026-10-08
- 関連: [T-0014](../trials/0014-hosting.md)、[T-0017](../trials/0017-KEY-traffic-capacity.md)
- 関連 ADR: [ADR-0010](0010-hosting-vercel-render-cloudflare.md)、[ADR-0014](0014-shared-postgres-checkpoints.md)

## 決定

既存の Docker API を ECS Fargate へ配置し、ALB で振り分ける。会話ストアは RDS PostgreSQL。
構成は [infra/aws](../../infra/aws/README.md) の Terraform で管理する。
最初は外部サービスを一定時間待つ偽物にし、自動スケーリングを無効にして1タスクと2タスクを比較する。
実 API の試験は TLS 証明書と検証用ドメインを設定した後に行う。

検証用タスクはパブリックサブネットに置き、ALB だけから受信する。外向きの通信に NAT Gateway は使わない。
RDS は非公開・Single-AZ、タスクの最小数は1。検証クライアントの IP に ALB の受信元を限定する。
フロントは Vercel を継続し、本番 API の DNS は変更しない。

## 理由と代替案

Docker の実行環境と HTTP の負荷分散を AWS の管理サービスでそろえる。ECS の台数を固定して比較でき、その後は自動スケーリングへ進める。
EC2 一台への配置は選択肢だが、ホスト更新と複数台の管理が増える。今回は Fargate を選ぶ。

## 限界

専用の操作ロールから実アカウントで作成し、ALB配下の2タスクによる会話共有と624件の模擬負荷を検証した。
同時60件の最大応答時間は1台35.869秒・2台18.127秒。[レポート](../reports/20261008_aws-traffic-capacity.md)に条件と削除確認を記録した。
ローカル Docker のI/O障害に対応するため、一時的なCodeBuildとソースS3を追加した。これらも検証後に削除した。
実API・本番Gunicorn起動・持続負荷・費用はまだ測っていない。外部 API のクォータは、タスクを増やしても増えない。
本番配置へ進む前に、検証結果と本番の権限・DB 接続・可用性を見直す。
