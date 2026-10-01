# ADR-0012: API の型は OpenAPI から openapi-typescript で生成する

- ステータス: 採用（テンプレート規約からの例外）
- 日付: 2026-10-02（記録日。判断はそれ以前。[operations.md](../operations.md) から起こした）

## 背景
フロント（TypeScript）とバックエンド（Python）が別言語なので、API の型がずれやすい。

## 決定
- バックエンドで `scripts/export_openapi.py` を実行して `fastapi/openapi.json` を書き出す
- フロントで `npm run gen`（openapi-typescript）を実行し、`nextjs/frontend/gen/api.d.ts` を生成する（`prebuild` でも実行。`gen/` は .gitignore 済み）
- 呼び出しは `lib/api.ts` の薄いクライアントで行う

## 理由
- エンドポイントが少ない（`/request-assistance`・`/context/{id}`）。型だけ生成すれば十分

## 検討した代替案
| 案 | 良い点 | 見送った理由 |
|---|---|---|
| Orval（React Query の hooks まで生成） | テンプレート規約 `frontend-structure.md` の標準 | エンドポイントが少なく、React Query を入れるほどではない |

## 影響・見直し条件
- `frontend-structure.md` の「Orval → `gen/`」は「openapi-typescript → `gen/`」と読み替える。`gen/` を手で編集しない点は同じ
- エンドポイントが増え、キャッシュや再取得の制御が要るようになったら Orval + React Query を検討する
