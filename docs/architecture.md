# アーキテクチャ概要

## Shoppie とは（技術視点）

Shoppie は、ユーザーが音声またはテキストで話しかけると、**LangGraph エージェント**が意図を理解し、複数の EC モール API から商品を検索して返す Web アプリです。

- **フロントエンド**: Next.js（Vercel）
- **バックエンド**: FastAPI + LangGraph（Render / Docker）
- **LLM**: AWS Bedrock — Claude Haiku 4.5
- **商品検索**: Yahoo!ショッピング / 楽天市場 / Amazon（Creators API / PA-API）

## システム構成図

```mermaid
graph TD
    subgraph Browser["ユーザー（ブラウザ）"]
        A[👤 ユーザー]
        A1[Web Speech API — 音声入力]
        A2[Cookie: shoppie_context_id]
    end

    subgraph CF["Cloudflare"]
        B1[shoppie-agent.com<br/>DNS / SSL / CDN]
        B2[api.shoppie-agent.com<br/>DNS / SSL]
    end

    subgraph Vercel["Vercel — nextjs/frontend"]
        C["Next.js 15 / React 19"]
        C1["商品検索 UI"]
        C3["OpenAPI 型生成"]
    end

    subgraph Render["Render — fastapi/backend Docker"]
        D["Gunicorn 1 worker + FastAPI"]
        E["LangGraph エージェント"]
        G["LangGraph MemorySaver"]
        P["商品厳選（product_curation）"]
    end

    subgraph External["外部 API"]
        H["AWS Bedrock Claude Haiku 4.5"]
        I["Yahoo ショッピング API"]
        J["楽天市場 API"]
        K["Amazon Creators API / PA-API"]
    end

    A --> A1
    A --> A2

    A -- "1. https://shoppie-agent.com" --> B1
    B1 -- "2. Next.js アプリ配信" --> C
    C --- C1
    C --- C3

    A -- "3. API 直接呼び出し<br/>NEXT_PUBLIC_API_URL" --> B2
    B2 -- "4. FastAPI へ転送" --> D

    D --> E
    E --> G
    E --> P
    E -- "5. LLM 推論" --> H
    E -- "6. 商品検索ツール" --> I
    E --> J
    E --> K
```

## リクエストの流れ

```mermaid
sequenceDiagram
    participant U as ブラウザ
    participant F as Next.js
    participant A as FastAPI
    participant G as LangGraph
    participant M as MemorySaver
    participant API as モール API

    U->>F: 音声 / テキスト入力
    F->>A: POST /request-assistance<br/>{ text, context_id }
    A->>G: run_agent(text, thread_id)
    G->>M: 過去メッセージ取得
    G->>G: LLM がツール選択
    G->>API: Yahoo / 楽天 / Amazon 検索
    API-->>G: 商品リスト
    G->>M: 会話履歴保存
    G-->>A: 応答文 + 商品（生データ）
    A->>A: 厳選（最大10件）
    A-->>F: { message, products }
    F-->>U: チャット + 商品グリッド表示
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15, React 19, Tailwind CSS 4, Web Speech API |
| バックエンド | FastAPI, LangGraph, LangChain AWS, Gunicorn |
| LLM | AWS Bedrock — `anthropic.claude-haiku-4-5-20251001-v1:0` |
| 商品検索 | Yahoo v3 / 楽天 Ichiba / Amazon Creators API（PA-API 後方互換） |
| フロント配信 | Vercel（Root Directory: `nextjs/frontend`） |
| API 配信 | Render（Docker、`fastapi/backend`） |
| エッジ | Cloudflare（DNS / SSL / CDN） |
| 型定義 | OpenAPI → `openapi-typescript`（`npm run gen`） |

## API 通信方針

フロントエンドは **Next.js の API Routes を使わず**、ブラウザから FastAPI を直接呼び出します（CORS 設定済み）。

| エンドポイント | 用途 |
|--------------|------|
| `POST /request-assistance` | 商品検索・AI 応答 |
| `DELETE /context/{id}` | 会話文脈のリセット |
| `POST /chat` | （レガシー）チャット用 |

## ディレクトリ構成

```
Shoppie/
├── docs/                           # 技術ドキュメント
├── README.md                       # プロダクト概要
├── nextjs/frontend/
│   ├── app/                        # App Router（page.tsx がメイン UI）
│   ├── components/                 # UI コンポーネント
│   ├── hooks/                      # use-search, use-speech-recognition 等
│   ├── lib/                        # API クライアント、ログ
│   └── types/                      # OpenAPI 生成型
└── fastapi/
    ├── .env.sample
    ├── docker-compose.yml
    └── backend/
        ├── main.py                 # 起動エントリ
        ├── adapter/                # HTTP コントローラ・プレゼンター
        ├── domain/entities/        # Product, AgentResponse 等
        ├── usecase/                # ビジネスロジック
        └── infrastructure/
            ├── gateways/
            │   ├── langgraph/      # LangGraph エージェント
            │   ├── yahoo/
            │   ├── rakuten/
            │   └── amazon/
            ├── product_curation.py # 商品厳選
            ├── marketplace_config.py
            └── router/fastapi.py   # ルート定義
```
