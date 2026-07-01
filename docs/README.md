# Shoppie 技術ドキュメント

このディレクトリに、Shoppie の技術構成・実装・運用に関するドキュメントをまとめています。

## 目次

| ドキュメント | 内容 |
|-------------|------|
| [アーキテクチャ概要](./architecture.md) | システム全体像、リポジトリ構成、通信フロー |
| [LangGraph エージェント](./langgraph-agent.md) | 対話エージェントの仕組み、ツール、プロンプト、メモリ |
| [バックエンド（FastAPI）](./backend.md) | レイヤー構成、API エンドポイント、商品厳選ロジック |
| [フロントエンド（Next.js）](./frontend.md) | UI 構成、音声入力、状態管理、商品表示 |
| [モール API 連携](./marketplace-apis.md) | Yahoo / 楽天 / Amazon の検索 API と制約 |
| [セッション・デプロイ・開発](./operations.md) | 会話文脈、本番環境、環境変数、ローカル開発 |

## リポジトリ構成（クイックリファレンス）

```
Shoppie/
├── docs/                  # 本ドキュメント
├── nextjs/frontend/       # Next.js（Vercel）
└── fastapi/
    ├── .env.sample
    ├── docker-compose.yml
    └── backend/           # FastAPI + LangGraph（Render）
```
