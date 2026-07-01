# Shoppie Backend

FastAPI + LangGraph による商品検索エージェントのバックエンドです。

技術ドキュメントはリポジトリルートの **`docs/`** を参照してください。

- [LangGraph エージェント](../../docs/langgraph-agent.md)
- [バックエンド構成](../../docs/backend.md)
- [モール API 連携](../../docs/marketplace-apis.md)
- [セッション・デプロイ・開発](../../docs/operations.md)

## クイックスタート

```bash
cd fastapi/backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn main:app --reload --port 8000
```

環境変数は `fastapi/.env.sample` を参照。
