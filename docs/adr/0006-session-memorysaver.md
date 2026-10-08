# ADR-0006: 会話の文脈はプロセス内の MemorySaver に置き、DB・Redis は置かない

- ステータス: PostgreSQL 設定時は [ADR-0015](0015-shared-postgres-checkpoints.md) に置き換え。DB 未設定時の単一プロセス構成として維持
- 日付: 2026-10-02（記録日。判断はそれ以前。[technical-qa.md](../technical-qa.md)・[operations.md](../operations.md) から起こした）

## 背景
スケールより、まず対話が閉じる最小構成を優先した。ログインはなく、ブラウザ単位で会話を続けられればよい。

## 決定
- 会話のチェックポイントは LangGraph の `MemorySaver`（プロセスのメモリ）に置く
- 会話のキーは Cookie `shoppie_context_id`（UUID v4・7 日）→ API の `context_id` → LangGraph の `thread_id`
- Gunicorn のワーカーは 1 つに固定する（ワーカー間でメモリを共有できないため）
- 最終アクセスから 3 分でスレッドを消す（60 秒ごとに掃除）
- ユーザー認証はしない。`context_id` はスレッドのキーであり、秘密ではない

## 理由
- 当時は Redis / Postgres の運用コストが、得られるものより大きかった

## 検討した代替案
| 案 | 良い点 | 見送った理由 |
|---|---|---|
| Redis の checkpointer | 再起動に耐える。ワーカーを増やせる | 運用コスト。将来の第一候補 |
| Postgres に永続化 | 履歴を長く残せる | 同上。長期の履歴は今は要らない |

## 影響・見直し条件
- Render の再起動で文脈が消える。サーバーのメモリ上の文脈は Cookie の期限（7 日）より短命
- テンプレート規約 `llm-wrapper-service.md` の「ステートレスにし、会話状態は外部ストアに置く」に反する。
  既知の例外として扱い、**ワーカーを増やす・複数台にする前に Redis checkpointer へ移す**
- 認証がなく、レート制限も薄い。公開 API の悪用対策は今後の課題
