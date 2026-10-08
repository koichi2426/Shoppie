# ADR-0010: フロントは Vercel、API は Render、前段は Cloudflare。BFF は置かない

- ステータス: 採用
- AWS の検証環境: [ADR-0015](0015-aws-api-validation.md)。本番の配置変更は未実施
- 日付: 2026-10-02（記録日。判断はそれ以前。[technical-qa.md](../technical-qa.md)・[operations.md](../operations.md) から起こした）

## 背景
フロントとエージェントの障害の範囲を分けつつ、それぞれ得意な場所に置きたい。

## 決定
| 層 | 置き場所 | 理由 |
|---|---|---|
| フロント | Vercel（`nextjs/frontend`） | Next.js との親和性 |
| API | Render（Docker、`fastapi/backend`） | Gunicorn 1 ワーカーで MemorySaver を守れる（[ADR-0006](0006-session-memorysaver.md)） |
| 前段 | Cloudflare（DNS / SSL / CDN） | `shoppie-agent.com`・`api.shoppie-agent.com` |

ブラウザから FastAPI を直接呼ぶ。Next.js の API Routes（BFF）は経由しない。秘密はバックエンドだけに置き、CORS で本番ドメインと localhost を許可する。

## 理由
- BFF を挟むと、フロントのデプロイとエージェントの障害が結びつきやすい。直接呼ぶ方が経路が単純

## 検討した代替案
| 案 | 良い点 | 見送った理由 |
|---|---|---|
| Next.js API Routes を BFF にする | CORS が要らない。秘密をサーバー側に置ける | 経路が増え、障害の範囲が結びつく |

## 影響・見直し条件
- CORS と 2 系統のデプロイを運用する必要がある
