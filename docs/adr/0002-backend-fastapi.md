# ADR-0002: バックエンドは FastAPI（Python）にする

- ステータス: 採用
- 日付: 2026-10-02（記録日。判断はそれ以前。[technical-qa.md](../technical-qa.md) から起こした）

## 背景
バックエンドの中心は「LLM エージェントがツールを呼び、モール API を叩く」処理で、HTTP API そのものは薄い。

## 決定
FastAPI（Python）で作り、Gunicorn + Uvicorn ワーカーで動かす。

## 理由
- LangGraph / LangChain / Bedrock SDK が Python 中心。エージェント・LLM・モール SDK を同じ言語圏に置ける
- Pydantic で StructuredTool の引数（ツールスキーマ）を型として書ける
- 外部 API 呼び出しが多いサービスに向く。個人開発で速く回せる

## 検討した代替案
| 案 | 良い点 | 見送った理由 |
|---|---|---|
| Django | 管理画面が強い | エージェント API＋ツール実行が中心の用途には重い |
| Nest / Node | フロントと同じ言語にできる | LangGraph のエコシステムから遠い |
| Next.js だけで完結 | デプロイが 1 つで済む | 秘密鍵やエージェントをブラウザの近くに置きたくない |

## 影響・見直し条件
- フロントとバックエンドが 2 言語・2 デプロイになる。型は OpenAPI で同期する（[ADR-0012](0012-openapi-typescript.md)）
