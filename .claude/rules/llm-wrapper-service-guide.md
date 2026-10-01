---
description: LLMラッパーサービス(OpenAI/Anthropicなどをラップした自社バックエンド)の標準アーキテクチャ
paths:
  - "fastapi/backend/infrastructure/gateways/langgraph/**/*.py"
  - "fastapi/backend/infrastructure/domain_impl/**/*.py"
  - "fastapi/backend/usecase/**/*.py"
---

# LLMラッパーサービス 構築ガイド

短文: `.claude/rules/llm-wrapper-service.md`(毎回適用)。コンテキスト構築の詳細は `.claude/rules/ai-agent-context-engineering-guide.md` を参照。
本文書は、いわゆる「LLMをそのまま使う」のではなく、OpenAI/Anthropicなどの LLM APIをラップして自社サービスを提供するバックエンド全体の標準構成をまとめたもの。

## 今プロジェクトへの再現チェックリスト

- [ ] バックエンドはユーザー(エージェント)ごとに専用プロセスを立てない**ステートレス**にし、会話状態は外部ストア(Redis・RDB)に置く
- [ ] LLM APIキーはバックエンドの外に一切出さない。クライアントには自社発行の短命トークンのみ渡す
- [ ] 会話履歴は毎回DBから復元して `messages[]` を組み立てる**直近ウィンドウに上限**を設ける。古い文脈は要約かRAGで選択的に注入する(詳細は `ai-agent-context-engineering-guide.md`)
- [ ] 複数プロバイダ(OpenAI/Anthropic/Gemini/ローカルモデル)を統一インターフェースの裏に隠す
- [ ] レート制限・課金は**リクエスト数ではなくトークン数**で計測する
- [ ] リトライ(指数バックオフ)・モデルフォールバック・サーキットブレーカーを実装する
- [ ] ストリーミングはSSEを使い、経路上の全てのプロキシバッファリングを無効化する
- [ ] 入力・出力の両方にガードレール(プロンプトインジェクション対策・PIIフィルタ)を通す
- [ ] 1リクエストあたりの実トークン数・コスト・レイテンシをログ・観測できるようにする

## 1. 全体構成意図

```text
┌──────────┐     ┌───────────────┐     ┌────────────────────────┐     ┌─────────────────────┐
│ Client   │ ──▶ │ API Gateway   │ ──▶ │ App層(ステートレス)   │ ──▶ │ LLMプロバイダAPI     │
│ Web/App  │     │ 認証・Rate制限 │     │ FastAPI + Uvicorn群    │     │ OpenAI/Anthropic…   │
└──────────┘     └───────────────┘     └───────────┬────────────┘     └─────────────────────┘
                                                     │ 読み書き
                                          ┌──────────┴───────────┐
                                          │ 外部ストア層          │
                                          │ Redis(キャッシュ・W) │
                                          │ Postgres(履歴・課金) │
                                          └────────────────────────┘
```

複数ユーザー(エージェント)が同じアプリ層プロセス群を共有するため、プロセス内にどのユーザーの会話も記憶させず、リクエストごとにIDをキーにして外部ストアから状態を取り出す。

## 2. バックエンド構成(FastAPI + Uvicorn/Gunicorn)

- 本番は `gunicorn -k uvicorn.workers.UvicornWorker` のようにワーカープロセスを複数立て、ロードバランサ(nginx/ALB等)配下に並べる(ワーカー間で状態を共有しないため、どのワーカーに当たっても同じ結果になる。ステートレス設計の前提)
- ワーカー数はCPUコア数基準ではなく、**LLM呼び出し待ちでI/Oブロックしている時間が長い**ことを踏まえ、非同期(`async def` エンドポイント、`httpx.AsyncClient`等の非同期HTTPクライアント)を徹底し、1ワーカーあたり多くの同時リクエストを捌けるようにする
- ユーザー(エージェント)ごとに専用コンテナ・専用プロセスを常時起動する設計は避ける(アンチパターン参照)。隔離が必要なのはコード実行系サンドボックスを持つ場合に限る

## 3. 会話履歴・状態管理

### DB設計の基本形

```text
sessions   (session_id, user_id, agent_id, created_at, …)
messages   (message_id, session_id, role, content, token_count, created_at)
usage_logs (session_id, provider, model, prompt_tokens, completion_tokens, cost_usd, created_at)
```

### Redisの役割分担

- **直近会話ウィンドウ**(例: 直近10〜20往復)— リスト型で `LPUSH`/`LTRIM` して常に上限を保つ。上限をゼロ(無制限)にしたまま本番投入しない → 会話が伸びるほど1リクエストのトークン数・コスト・レート制限抵触頻度が悪化する
- **レート制限カウンタ** — トークンやリクエスト等をユーザー(エージェント)単位のキーで持つ
- **セマンティックキャッシュ** — 埋め込みベクトルの近傍検索結果をキャッシュし、類似質問への再生成コストを避ける

### messages[] の組み立て(毎リクエスト)

```text
┌────────────────────────────────────────────┐
│ role: system    … 固定のシステムプロンプト     │
│ role: user      … 過去の発言(DBから復元)     │
│ role: assistant … 過去の応答(DBから復元)     │
│        ⋮          (直近N往復に制限)          │
│ role: user      … 今回の入力                  │
└────────────────────────────────────────────┘
```

LLM APIはリクエストをまたいで何も記憶しないが、会話が続いているように見えるのは、こちら側が毎回この配列を組み立てて送っているだけ。

## 4. LLM呼び出しの実装パターン(非同期・ストリーミング)

FastAPIでのSSE送信は `StreamingResponse`(生のHTTPストリーミング)または `sse-starlette` の `EventSourceResponse`(イベント名付き・`EventSource`のブラウザAPIとの相性が良い)を使う。チャットUXのような1問1答ストリームで返す用途では後者が扱いやすい。

```python
# FastAPI + SSE の骨格例
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import httpx

app = FastAPI()

async def stream_from_provider(payload: dict):
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", PROVIDER_URL, json=payload, headers=AUTH_HEADERS) as resp:
            async for line in resp.aiter_lines():
                if line:
                    yield f"data: {line}\n\n"  # SSEフレーム形式へ転記

@app.post("/v1/chat")
async def chat(req: ChatRequest):
    return StreamingResponse(
        stream_from_provider(build_payload(req)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginxのバッファリングを無効化
        },
    )
```

**経路上の全てのプロキシバッファリングを無効化すること**が最大の落とし穴。nginxの `proxy_buffering off`、CDN/ALBの相当設定を1箇所でも忘れると、ストリーミングしているのに体感は一括表示になる。再接続耐性を持たせるなら、各イベントに `id:` を付けて再接続時に `Last-Event-ID` からリプレイを再開できるようにするのが定石。

## 5. マルチプロバイダー対応

呼び出し側は `complete(provider, model, messages)` のような単一シグネチャしか知らない統一インターフェースの裏にプロバイダーごとのSDK差異(リクエスト形式・エラーコード・ストリーミング形式)を隠す(アダプタ/ストラテジーパターン)。

自前でこの層を書く代わりに **LiteLLM** を使う選択肢もある。LiteLLMは100以上のプロバイダをOpenAI互換の1エンドポイントの裏に統一し、モデル障害時の自動フォールバック(例: 主モデルが失敗→別プロバイダの順に試行)やコスト集計まで面倒を見る。

```yaml
# LiteLLM config.yaml の骨格例
model_list:
  - model_name: default
    litellm_params:
      model: gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  - model_name: default
    litellm_params:
      model: claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY
router_settings:
  fallbacks: [{ "default": ["default"] }]  # 1つ目が失敗したら2つ目を試す
```

もう一段上のインフラ層でトークン単位のレート制限やコスト保護を横断的に一元管理したい場合は **Envoy AI Gateway**(Envoy Proxyの拡張、2025年にTetrateとBloombergがOSS化・CNCF寄付)が候補になる。アプリ層の統一インターフェース(LiteLLM相当)とインフラ層のトラフィック制御(Envoy AI Gateway相当)は別の層の話であり、混同しない。

## 6. レート制限・課金・信頼性設計

### トークン数ベースの制御

50トークンのリクエストと50,000トークンのリクエストを同列に扱う「リクエスト数」の制限は、プロバイダ側の実際のTPM(Tokens Per Minute)制限とズレる。入力・出力・reasoningトークンをユーザー(エージェント)単位で積算し、消費リソース(トークン数)として制御する。

```python
# トークンバケット風レート制限の骨格例(Redis)
async def check_and_consume_tokens(redis, key: str, tokens_needed: int, limit_per_min: int) -> bool:
    used = await redis.incrby(key, tokens_needed)
    if used == tokens_needed:
        await redis.expire(key, 60)  # 初回のみTTLを立てる
    return used <= limit_per_min
```

### リトライ・フォールバック・サーキットブレーカー

```text
   リクエスト
      │
      ▼
 ┌──────────────┐   429 / 5xx    ┌──────────────────────┐
 │ Primaryモデル │ ─────────────▶ │ リトライ              │
 │ (例: GPT-4o)  │                │ (指数バックオフ)      │
 └────────┬───────┘                └──────────┬───────────┘
          │成功                              │規定回数失敗
          ▼                                   ▼
      応答を返す                     ┌──────────────────────┐
                                    │ Fallbackモデル        │
                                    │ (例: 別プロバイダ)     │
                                    └──────────────────────┘
```

- 429/401/403等の「別の認証情報にすれば成功するかもしれないエラー」はリトライ・フォールバック対象にする。それ以外(400等の入力自体の問題)は即座にエラーを返す → リトライで治らないものをリトライしない
- サーキットブレーカーはエラー率だけでなく**レイテンシの急上昇**でも回路を開く。ルートごとに30〜60秒程度のタイムアウト予算を設けるのが目安

## 7. セキュリティ

### APIキーの秘匿

```text
✗ NG  [ブラウザ/アプリ] ──(自社のLLMキーを直接埋め込み)──▶ [LLM API]
✓ OK  [ブラウザ/アプリ] ──(自社の短命トークンのみ)──▶ [自社バックエンド] ──(キーはサーバー側のみ)──▶ [LLM API]
```

クライアントに渡すのは自社発行の短命トークンのみ。LLMプロバイダのAPIキーはサーバー側の環境変数・シークレットストアに置き、フロントエンドのコードやアプリバイナリに埋め込まない。

### プロンプトインジェクション・PII対策(ゲートウェイ層)

OWASPは2025年版Top 10 for LLM Applicationsで、プロンプトインジェクションを3年連続でLLM01(最重要脆弱性)に位置付けている。2026年時点で定着している防御は多層構造:

1. **入力ガードレール** — 全トラフィックに実行。systemメッセージと外部由来のコンテンツ(ユーザー入力・検索結果・ツール出力)を構造的に分離し、後者が指示として解釈されないようにする
2. **ツールの最小権限化** — エージェントが呼べるツール・アクセスできるURLをホワイトリスト化
3. **出力ガードレール** — 全応答に実行。APIキーやJWT等の漏洩パターンを正規表現/エンティティ認識で検出し、PIIをマスキング/ブロック
4. **継続的なレッドチーム検証** — 新しい攻撃パターンへの回帰テストを継続的に回す

## 8. アンチパターン

- **ユーザー(エージェント)ごとに専用コンテナ・専用プロセスを常時起動する** — 大半の時間はアイドルで課金だけが発生し、利用者数に比例してインフラコストと起動待ちが線形に増える。LLM呼び出し自体は外部APIへのHTTPコールなので、そもそもGPUや専用プロセスが不要
- **DBに保存した全履歴をそのまま毎回 `messages[]` に詰め込む** — 会話が伸びるほどトークン数・コスト・レート制限抵触頻度が悪化する。上限・要約・RAGでの選択的注入が必須(詳細は `ai-agent-context-engineering-guide.md`)
- **プロバイダの生SDKを画面/ユースケースのコードに直接書く** — プロバイダを追加・変更するたびに呼び出し側全体を書き換えることになる
- **1リクエスト数だけでレート制限をする** — トークン数の異なるリクエストを同列に扱うと、実際のプロバイダ側TPM制限との整合が取れない
- **プロンプトエンドにAPIキーを直接埋め込む** — 逆コンパイル/通信傍受で容易に抽出される。必ずバックエンド経由のプロキシを挟む
- **system promptに「運営の指示を優先すること」と書くだけでプロンプトインジェクション対策を終わらせる** — 指示だけでの分離は容易に突破される。構造的な分離とツール権限の制限を併用する
- **ストリーミング実装で経路上の一部プロキシだけバッファリングを無効化して満足する** — 1箇所でも見落とすとストリーミングしているのに体感は一括表示になる。全レイヤーで確認する

## 参考文献

以下は本書の起稿にあたり実際にアクセスして内容を確認したもの。

- [The AI-Native Backend: How LLMs Are Changing API Design](https://vinitshahdeo.substack.com/p/ai-native-backend-llm-api-design) — ステートレス設計・トークンベースのレート制限・3層キャッシュ・サーキットブレーカー・プロンプトのバージョン管理
- [AI Model Serving Architecture: Building Scalable Inference APIs](https://www.runpod.io/articles/guides/ai-model-serving-architecture-building-scalable-inference-apis-for-production-applications) — vLLM/SGLang/TensorRT-LLMの比較、量子化、ゲートウェイ層のトークンベースレート制限
- [bentoml/OpenLLM](https://github.com/bentoml/OpenLLM) — OSSモデルをvLLM上でOpenAI互換APIとして配信するツールの構成
- [dataopsnick/lambda-llm-proxy](https://github.com/dataopsnick/lambda-llm-proxy) — サーバーレス(AWS Lambda)でのSSEストリーミングプロキシ実装例、APIキー秘匿の最小構成
- [LiteLLM Documentation](https://docs.litellm.ai/docs/) — マルチプロバイダー統一インターフェース、フォールバック設定
- [Running LiteLLM as a Proxy in Front of Multiple LLM Providers](https://medium.com/data-science-collective/running-litellm-as-a-proxy-in-front-of-multiple-llm-providers-528f74ebb30b)
- [Usage-based Rate Limiting — Envoy AI Gateway](https://aigateway.envoyproxy.io/docs/0.1/capabilities/usage-based-ratelimiting/) — トークン使用量の自動抽出とCELベースのカスタムコスト計算
- [envoyproxy/ai-gateway](https://github.com/envoyproxy/ai-gateway) — Envoy Gateway拡張としてのAIゲートウェイ、2025年にTetrate/BloombergがOSS化・CNCF寄付
- [Prompt Injection Defense for Production AI Agents: A Complete 2026 Guide](https://www.getmaxim.ai/articles/prompt-injection-defense-for-production-ai-agents-a-complete-2026-guide/) — 入力/出力ガードレール、OWASP LLM01:2025
- [Prompt Injection Defense at the AI Gateway](https://www.truefoundry.com/blog/prompt-injection-defense-llm-gateway) — ゲートウェイ層でのdual-stageガードレール、MCPツールのallow-list
- [Streaming LLM Responses Without Breaking Your Backend](https://www.firsttoken.dev/p/streaming-llm-responses-without-breaking-your-backend) — SSEのプロキシバッファリング対策、`Last-Event-ID`での再接続
- [LLM Output Streaming and Real-Time Token Delivery Architectures](https://zylos.ai/research/2026-03-28-llm-output-streaming-token-delivery-architectures/)
