---
description: Clean Architecture 必守（毎回適用）
---

# Clean Architecture（必守）

詳細は必要なら `.claude/rules/clean-architecture-guide.md`（`fastapi/backend/**/*.py` 作業時）を参照。

## 依存方向

- `usecase` → `domain` のみ。`infrastructure` / `adapter` の import 禁止。
- `domain` → `infrastructure` の import 禁止。
- DB / HTTP / Docker / Redis / LLM SDK 等はドメインに **インターフェースのみ**。実装と DI は外側（`router` / `composition`）。

## ドメインオブジェクト

- **値オブジェクト**: 必ず `NewX` 経由。生成時バリデーション。不変。単なる dict/dataclass の袋にしない。
- **エンティティ**: 必ず `NewX` 経由。VO を組み立てる。永続化が要るなら Repository IF をドメインに置く（実装は外側）。
- **ドメインサービスは最低限**。正規化・判定は VO / エンティティへ。跨ぎ照合や外側技術ポートだけサービス可。

## ユースケース

- ドメインオブジェクトと IF だけでシナリオを組む。外側具象に依存しない。
- Input / Output は現実世界向けのプリミティブ（str / int 等）でよい。

## 禁止

- usecase から httpx / Docker socket / Redis クライアント等を直接叩くこと。
- 「サービス」名の純関数モジュールで VO を代替すること。
