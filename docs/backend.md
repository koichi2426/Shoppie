# バックエンド（FastAPI）

## レイヤー構成

クリーンアーキテクチャ風にレイヤーを分けています。

```
adapter/          HTTP の入り口（Controller）とレスポンス整形（Presenter）
usecase/          ビジネスロジック
domain/entities/  ドメインモデル（Product, AgentResponse 等）
infrastructure/   外部連携（LangGraph, モール API, ルーター）
```

| 層 | 役割 | 例 |
|----|------|-----|
| `adapter/controller` | リクエスト受付 | `RequestAssistanceController` |
| `adapter/presenter` | レスポンス整形 | `RequestAssistancePresenter` |
| `usecase` | ユースケース実行 | `RequestAssistanceUseCase` |
| `domain/entities` | エンティティ | `Product`, `AgentResponse` |
| `infrastructure/gateways` | 外部 API・エージェント | `langgraph_agent.py`, `yahoo_api.py` |
| `infrastructure/router` | FastAPI ルート定義 | `fastapi.py` |

## API エンドポイント

定義: `infrastructure/router/fastapi.py`

### `POST /request-assistance`

メインの商品検索・AI 応答 API。

**リクエスト:**
```json
{
  "text": "洗えるスニーカーある？",
  "context_id": "uuid-v4"
}
```

**レスポンス:**
```json
{
  "response": {
    "message": "いいの見つけたよ！",
    "products": [
      {
        "title": "商品名",
        "price": 3980,
        "image_urls": ["https://..."],
        "affiliate_url": "https://...",
        "description": "...",
        "marketplace": "Yahoo"
      }
    ]
  }
}
```

### `DELETE /context/{context_id}`

LangGraph の `MemorySaver` から該当 `thread_id` の会話履歴を削除します。フロントの「新しい会話」ボタンから呼ばれます。

## 商品検索の処理パイプライン

```
RequestAssistanceUseCase.execute()
  → run_agent()           # LangGraph でツール実行・応答生成
  → curate_products()     # 最大10件に厳選
  → Product エンティティに変換
  → AgentResponse 返却
```

## 商品厳選

実装: `infrastructure/product_curation.py`

エージェントが返した商品リストを、画面表示用に **最大 10 件**に絞ります。

### 方針

- 利用可能なモールごとに **均等配分**（3 モールなら 3+3+4 件など）
- 各モール内ではスコア順にソート

### スコアリング要素

| 要素 | 重み |
|------|------|
| API の返却順（先頭ほど高評価） | 高 |
| 価格が取得できている | +50 |
| レビュー評価（Yahoo / 楽天） | 評価 × 20 |
| レビュー件数 | log スケール |
| 画像あり | +5 |
| Amazon 検索リンクのみ | 最優先度低（含めるが後回し） |

### marketplace フィールド

各商品に `marketplace`（`Yahoo` / `楽天` / `Amazon`）を付与し、フロントのカードバッジ表示に使います。

## 応答文の短文化

`infrastructure/agent_response.py` の `compact_assistant_message` で、商品がある場合は LLM の長文を 2 文 / 150 字以内に圧縮します。

## ログ

`infrastructure/log_util.py` で構造化ログを出力します。

| ロガー名 | 内容 |
|---------|------|
| `shoppie.api` | HTTP リクエスト |
| `shoppie.agent` | LangGraph イベント |
| `shoppie.usecase.request_assistance` | ユースケース |
| `shoppie.yahoo` / `shoppie.rakuten` / `shoppie.amazon` | モール API |
| `shoppie.products` | 商品厳選 |

## OpenAPI

- スキーマ: `infrastructure/router/schemas.py`
- 出力: `fastapi/openapi.json`（`scripts/export_openapi.py` で生成）
- フロントの型生成: `nextjs/frontend` で `npm run gen`
