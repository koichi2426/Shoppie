# Shoppie（ショッピー）｜話すだけで、買い物が進む

## Shoppieとは

**Shoppie** は、店員との会話のように自然な対話で商品を探せる
**音声ショッピングアプリ**です。
検索や操作の手間をなくし、話しかけるだけで商品が見つかります。

---

## 従来のショッピングが抱える課題

* 検索やカテゴリ選択など、手動操作が多く煩雑
* 欲しいものが曖昧だと、探しにくい
* スマートフォンやPCの操作が苦手な人には使いにくい
* 高齢者や視覚に不安のある人にとって情報取得のハードルが高い

---

## Shoppieによる解決

* 音声だけで商品検索が完結
* 曖昧なニーズにも自然言語で対応
* ボタン操作・タイピング不要のシンプルなUI
* LangChainによる文脈理解で、発言の流れを把握して提案

---

## 機能の特徴

* 音声による商品検索
  例：「洗えるスニーカーある？」など自然な会話形式で検索可能

* LangChainによる対話制御
  会話の意図や前後関係を理解し、カテゴリ提案や商品比較も実行

---

## アプリ名の由来

「Chatty（おしゃべり）」と「Shopping（買い物）」を組み合わせた造語。
会話しながら買い物を楽しめる体験を表現しています。

---

## 技術構成

### リポジトリ構成

```
Shoppie/
├── nextjs/frontend/   # Next.js（Vercel デプロイ）
└── fastapi/backend/   # FastAPI + LangGraph（Render デプロイ）
```

### 構成図

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
        C[Next.js 15 / React 19]
        C1[商品検索 UI]
        C2[会話履歴ドロワー]
        C3[/admin 管理画面]
        C4[OpenAPI 型生成 gen/]
    end

    subgraph Render["Render — fastapi/backend（Docker）"]
        D[Gunicorn 1 worker + FastAPI]
        E[LangGraph エージェント]
        F[(SQLite sessions.db)]
        G[LangGraph MemorySaver]
    end

    subgraph External["外部 API"]
        H[AWS Bedrock<br/>Claude Haiku 4.5]
        I[Yahoo!ショッピング API]
    end

    A --> A1
    A --> A2

    A -- "1. https://shoppie-agent.com" --> B1
    B1 -- "2. Next.js アプリ配信" --> C
    C --- C1
    C --- C2
    C --- C3
    C --- C4

    A -- "3. API 直接呼び出し<br/>NEXT_PUBLIC_API_URL" --> B2
    B2 -- "4. FastAPI へ転送" --> D

    D --> E
    E --> F
    E --> G
    E -- "5. LLM 推論" --> H
    E -- "6. 商品検索ツール" --> I
```

### 主な技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15, React 19, Tailwind CSS, Web Speech API |
| バックエンド | FastAPI, LangGraph, Gunicorn, SQLite（会話履歴永続化） |
| LLM | AWS Bedrock — Claude Haiku 4.5 |
| 商品検索 | Yahoo!ショッピング API |
| フロント配信 | Vercel（Root Directory: `nextjs/frontend`） |
| API 配信 | Render（Docker、`fastapi/backend`） |
| エッジ | Cloudflare（DNS / SSL / CDN） |
| 型定義 | OpenAPI → `openapi-typescript`（`npm run gen`） |

### API 通信

フロントエンドは Next.js の API Routes を使わず、ブラウザから FastAPI を直接呼び出します。

| エンドポイント | 用途 |
|--------------|------|
| `POST /request-assistance` | 商品検索・AI応答 |
| `GET /admin/sessions/{id}` | 会話履歴取得 |
| `DELETE /admin/sessions/{id}` | チャットリセット |
| `GET /admin/sessions` | 全セッション一覧（管理画面） |

