# セッション・デプロイ・開発

## 会話文脈（セッション）

会話 ID は Cookie の UUID を使う。チェックポイントの保存先は設定で選ぶ。

| 設定 | 保存先 | 再起動と複数台 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | API 再起動後も、同じ DB を使う API 間でも共有 |
| `DATABASE_SECRET_ARN` + `DATABASE_HOST` | RDS PostgreSQL | ECS タスクロールで接続情報を取得。新規接続時に現在のパスワードを取得 |
| 両方未設定 | MemorySaver | 従来どおりプロセス内。1プロセスだけで使う |

保存内容は LangGraph のチェックポイント（HumanMessage / AIMessage / ToolMessage と商品 JSON）。
`context_id` が `thread_id` に対応し、フロントの Cookie の期限は7日。
DB に保存しても会話は短命で、最終アクセスから180秒が保持期間の既定値。
`CONVERSATION_IDLE_TTL_SECONDS` で変更できる。

### 同時処理と削除

- 会話単位のロックを持ってグラフを実行する。PostgreSQL ではサーバー間共通の advisory lock を使う。
- 同じ会話への次の処理は最大15秒ロックを待ち、それを超えると失敗する。異なる会話は並列に処理できる。
- 実行開始・終了時に最終アクセスを更新する。PostgreSQL では `shoppie_conversations` に保存する。
- 各 API が60秒ごとに期限を確認する。実行中の会話は削除しない。ロック取得後に期限を再確認する。
- 「新しい会話」の `DELETE /context/{context_id}` も同じロックを取ってから削除する。
- DB の作成・マイグレーションは lifespan 起動時に実行し、同時起動では順番に実行する。
- `/healthz` は保存先への接続を確認し、利用できなければ503を返す。

### AWS の検証環境

[構成と実行手順](../infra/aws/README.md)に ALB・ECS Fargate・RDS・ECR・IAM をまとめた。
AWS上で模擬APIの会話共有と1・2タスクの負荷比較を実施し、検証用リソースと専用IAMを削除した。
[測定と削除確認のレポート](reports/20261008_aws-traffic-capacity.md)に生データと条件を保存している。
現在の本番配置は下記の Render / Vercel。本番切り替えはまだ実施していない。

## 本番デプロイ

### フロントエンド（Vercel）

| 項目 | 値 |
|------|-----|
| Root Directory | `nextjs/frontend` |
| Framework | Next.js |
| 環境変数 | `NEXT_PUBLIC_API_URL=https://api.shoppie-agent.com` |
| ドメイン | `shoppie-agent.com`（Cloudflare 経由） |

### バックエンド（Render）

| 項目 | 値 |
|------|-----|
| 種別 | Web Service（Docker） |
| Dockerfile | `fastapi/backend/Dockerfile` |
| ポート | 8000 |
| ドメイン | `api.shoppie-agent.com` |

Docker 起動コマンド（Dockerfile 内）:

```
gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

### Cloudflare

- `shoppie-agent.com` → Vercel
- `api.shoppie-agent.com` → Render
- DNS / SSL / CDN

## 環境変数

テンプレート: `fastapi/.env.sample`

### AWS Bedrock

```
BEDROCK_AWS_ACCESS_KEY_ID=
BEDROCK_AWS_SECRET_ACCESS_KEY=
BEDROCK_AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0
```

### Yahoo

```
YAHOO_APP_ID=
YAHOO_AFFILIATE_ID=
VC_SID=
VC_PID=
```

### 楽天

```
RAKUTEN_APP_ID=
RAKUTEN_ACCESS_KEY=
RAKUTEN_AFFILIATE_ID=
RAKUTEN_HTTP_REFERER=https://shoppie-agent.com/
```

### Amazon

```
AMAZON_CREATORS_CREDENTIAL_ID=
AMAZON_CREATORS_CREDENTIAL_SECRET=
AMAZON_CREATORS_VERSION=3.3
AMAZON_PARTNER_TAG=
AMAZON_MARKETPLACE=www.amazon.co.jp
AMAZON_ACCESS_KEY=        # PA-API（任意）
AMAZON_SECRET_KEY=
AMAZON_REGION=us-west-2
```

## ローカル開発

### バックエンド

```bash
cd fastapi
cp .env.sample .env   # 値を入力
docker compose up     # または backend ディレクトリで直接起動
```

```bash
cd fastapi/backend
pip install -r requirements.txt
# PostgreSQL を使う場合は DATABASE_URL を設定する（例は .env.sample）。
PYTHONPATH=. uvicorn main:app --reload --port 8000
```

### フロントエンド

```bash
cd nextjs/frontend
cp .env.sample .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

### OpenAPI 型の更新

バックエンドのスキーマを変更したら:

```bash
cd fastapi/backend
PYTHONPATH=. python scripts/export_openapi.py

cd nextjs/frontend
npm run gen
```

## CORS

`infrastructure/router/fastapi.py` で許可オリジン:

- `https://shoppie-agent.com`
- `http://localhost:3000`

## 反応イベントの保存（Supabase）

`INTERACTION_DATABASE_URL` が設定されている場合、反応イベントを Supabase の PostgreSQL に保存する。会話履歴用の `DATABASE_URL` とは別に設定する。Vercel・Render の配置はそのまま使う。プロジェクト作成・SQL・接続・集計の手順は [Supabase の README](../infra/supabase/README.md)を参照。Supabaseへの接続は確認済み。Render側の接続設定はまだ実施していない。

## 会話履歴の保存（Supabase）

`DATABASE_URL` と `INTERACTION_DATABASE_URL` に同じ Session pooler 接続文字列を設定する。`CONVERSATION_DB_SCHEMA=shoppie_checkpoints` と `CONVERSATION_IDLE_TTL_SECONDS=0` で非公開スキーマと文脈の保持を選ぶ。分析用履歴はリセットで削除しない。Supabase接続・保存・文脈再開は確認済み。Render側の設定はまだ実施していない。
