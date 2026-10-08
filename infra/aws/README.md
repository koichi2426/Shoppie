# Shoppie API の AWS 検証環境

API を ALB + ECS Fargate に置き、会話チェックポイントを RDS PostgreSQL で共有する。
フロントは現在の Vercel のまま。本番 DNS の切り替えは含まない。

## 構成

```text
検証クライアント → ALB → Fargate の FastAPI × 1 または 2
                              ↓
                      RDS PostgreSQL（共有）
```

- 東京リージョン、2 AZ の ALB、0.5 vCPU / 1 GiB の Fargate タスク。
- RDS は非公開・暗号化・Single-AZ の db.t4g.micro。検証では RDS 管理の DB ユーザーを使う。
- DB パスワードは RDS が Secrets Manager で管理する。アプリは新しい DB 接続ごとに現在の値を取得する。
- タスクにはパブリック IP を割り当て、受信を ALB からの8000番に限定する。モール API への外向き通信に NAT Gateway を使わない。
- ALB の受信元は ingress_cidrs に限定する。既定値は空で外部から到達できない。
- 最初は偽物の Bedrock・モール API を使う。HTTP はこの試験に限る。実 API を有効にする場合は発行済み ACM 証明書が必要。
- 自動スケーリングは比較中は無効。比較後は ALB のリクエスト数を使って1〜4タスクへ調整できる。設定値は実測で決める。
- ALB・Fargate・RDS・Secrets Manager・ログ・パブリック IP 等に費用が発生する。最初の apply でも RDS と ALB は作成される。

## AWS へのログイン

AWS CLI 2.32.0 以上でブラウザからログインできる。2.27.21 では aws login が使えない。
Homebrew でインストールした CLI は、必要なら `brew upgrade awscli` で更新する。

```sh
scripts/aws_cli.sh login --profile shoppie --region ap-northeast-1
scripts/aws_cli.sh sts get-caller-identity --profile shoppie --region ap-northeast-1
```

macOS の Homebrew Python とシステム libexpat の組み合わせで CLI が起動しない場合は、
`brew install expat` と [scripts/aws_cli.sh](../../scripts/aws_cli.sh) を使う。
このラッパーは AWS CLI のプロセスだけにライブラリの場所を設定する。

IAM ユーザー・ロールには SignInLocalDevelopmentAccess と、今回作るリソースの操作権限が必要。
IAM Identity Center を使うアカウントでは、代わりに `aws configure sso --profile shoppie` と
`aws sso login --profile shoppie` を使う。認証キーはリポジトリやチャットに保存しない。

Terraform が console login を直接読めない場合は、公式の process credentials 経由にする。

```sh
scripts/aws_cli.sh configure set credential_process 'aws configure export-credentials --profile shoppie --format process' --profile shoppie-terraform
scripts/aws_cli.sh configure set region ap-northeast-1 --profile shoppie-terraform
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
export AWS_PROFILE=shoppie-terraform
scripts/aws_cli.sh sts get-caller-identity
```

### 検証用の操作権限

今回の検証では `ShoppieValidationDeployer` ロールと、それを引き受ける専用の
`shoppie-validation-operator` ユーザーを作成した。ユーザーには AssumeRole の権限だけを付け、
インフラ操作は `shoppie-deployer` プロファイルから行った。
ロールの操作ポリシーは [bootstrap/deployer-policy.json](bootstrap/deployer-policy.json)。
信頼ポリシーの Principal / 条件は自分のアカウントと操作主体に限定する。
既存の `shoppie-agent` ユーザーは使わない。
検証終了時には専用ユーザー・キー・ロールとローカルの専用プロファイルも削除する。
継続運用では IAM Identity Center 等の既存の認証基盤からこの操作ロールを引き受ける。

macOS でラッパーが必要な場合は credential_process 内の `aws` も
ラッパーの絶対パスへ置き換える。Terraform の実行ディレクトリから相対パスが解決されるとは限らない。

## インフラを作成する

リポジトリルートから実行する。state は gitignore 対象。検証ではローカル state を使う。
共同運用前に、暗号化とロックを設定した S3 backend へ移す。

```sh
cp infra/aws/terraform.tfvars.example infra/aws/terraform.tfvars
# ingress_cidrs を自分のパブリック IP /32 に変更する。image_uri は最初は空。
terraform -chdir=infra/aws init
terraform -chdir=infra/aws plan -out=validation.tfplan
terraform -chdir=infra/aws apply validation.tfplan
```

## イメージを ECR に送る

Apple Silicon でも Fargate と同じ linux/amd64 を指定する。タグは再利用しない。

```sh
SHOPPIE_REPO=$(terraform -chdir=infra/aws output -raw ecr_repository_url)
SHOPPIE_REGISTRY=${SHOPPIE_REPO%%/*}
SHOPPIE_TAG=$(date +%Y%m%d%H%M%S)
scripts/aws_cli.sh ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin "$SHOPPIE_REGISTRY"
docker buildx build --platform linux/amd64 --push -t "$SHOPPIE_REPO:$SHOPPIE_TAG" fastapi/backend
```

terraform.tfvars の image_uri を送ったイメージ URI に設定し、desired_count = 1 のまま plan/apply する。
タスク起動時にチェックポイントのテーブルを作る。複数タスクの同時起動は DB のロックで初期化を順番に実行する。

### 一時的な CodeBuild でビルドする

ローカル Docker が使えない場合は、ソースだけを ZIP にし、任意のビルダーを有効にする。
パッケージには `.env`、認証情報、仮想環境、シンボリックリンクを含めない。

```sh
python3 scripts/package_aws_build.py /tmp/shoppie-build-source.zip
```

terraform.tfvars に次を追加して plan/apply する。初期構成と同じ ECR に送信する。

```hcl
remote_build_enabled = true
build_source_zip = "/tmp/shoppie-build-source.zip"
build_image_tag = "validation-UNIQUE-TIMESTAMP"
cpu_architecture = "X86_64"
```

```sh
scripts/aws_cli.sh codebuild start-build --project-name shoppie-validation-build \
  --profile shoppie-deployer --region ap-northeast-1
```

ビルド成功後、ECR の describe-images で digest を取得し、
image_uri に `REPOSITORY@sha256:DIGEST` を設定する。1台・2台で同一イメージを使う。
CodeBuild・ソースの S3 バケット・ビルドロール・ログは検証後に一緒に削除する。

## 1台・2台で比較する

```sh
SHOPPIE_ALB=$(terraform -chdir=infra/aws output -raw alb_dns_name)
python3 fastapi/backend/scripts/load_test_client.py --url "http://$SHOPPIE_ALB" \
  --concurrency 1 3 10 30 --rounds 3 --label aws-one-task --out /tmp/aws-one-task.json
```

desired_count = 2 に変更して plan/apply し、ECS が安定した後で実行する。
応答ヘッダーと偽物の応答にある往復数で、両方のタスクに届いても履歴が続くことを検証する。

```sh
python3 fastapi/backend/scripts/load_test_client.py --url "http://$SHOPPIE_ALB" \
  --session-check --min-instances 2 --label aws-shared-history --out /tmp/aws-shared-history.json
python3 fastapi/backend/scripts/load_test_client.py --url "http://$SHOPPIE_ALB" \
  --concurrency 1 3 10 30 --rounds 3 --label aws-two-tasks --out /tmp/aws-two-tasks.json
```

CloudWatch Logs の /ecs/shoppie-validation には history_messages とエージェントの所要時間が出る。
JSON は各リクエストの応答時間、HTTP ステータス、エラー、送り先、p95、失敗率、バースト全体の処理件数/秒を含む。
短いバースト3回だけでは、持続負荷時の性能や安定した p95 は判断できない。
AWS の結果は測定条件とデータを添えた .md / .html のレポートにまとめる。

## 実 API へ進む

1. 検証用 API ドメインの ACM 証明書を東京で発行し、ALB へ DNS を向ける。
2. モール API の必要なキーを Secrets Manager に登録し、secret_env に ARN を指定する。値は tfvars に書かない。
3. certificate_arn を設定し、mock_external_services = false にする。
4. Bedrock のモデル・リージョン・クォータを確認し、同時1→3→5→10件で測定する。

HTTPS では --url https://検証用ドメイン を使う。--session-check は偽物専用なので使わない。
Bedrock は ECS タスクロールを使う。固定の AWS アクセスキーは渡さない。
本番移行前には DB のアプリ専用権限、TLS の証明書検証、保持期間とバックアップ、API の同時実行・受付上限を詰める。
AWS 上の接続・ローテーション・実 API・費用は、ローカル試験では確認できない。

## 片付け

保存するデータがある場合はバックアップの扱いを決めてから削除する。
今回の偽物による検証では実データを持たないため、以下を tfvars に設定して apply する。

```hcl
database_deletion_protection = false
database_skip_final_snapshot = true
ecr_force_delete = true
```

```sh
terraform -chdir=infra/aws plan -out=cleanup-settings.tfplan
terraform -chdir=infra/aws apply cleanup-settings.tfplan
terraform -chdir=infra/aws plan -destroy -out=cleanup.tfplan
terraform -chdir=infra/aws apply cleanup.tfplan
terraform -chdir=infra/aws state list
```

Terraform の削除が完了してから、リソース・DB スナップショット・管理シークレットの残存を確認する。
Terraform 外で作った検証用の IAM ユーザー・アクセスキー・操作ロールも最後に削除する。
ローカルの専用プロファイルとキャッシュを消し、既存の IAM と他の AWS リソースは維持する。

## 出典

- [ECS の負荷分散](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-load-balancing.html)
- [ECS の自動スケーリング](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html)
- [AWS CLI のブラウザログインと process credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)
- [RDS のパスワード管理](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html)
