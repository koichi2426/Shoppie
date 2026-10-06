# T-0010: バックエンドの層を、どう切るか

- 状態: 解決(`domain` / `usecase` / `adapter` / `infrastructure`。外部連携は `gateways`、ドメイン IF の実装は `domain_impl`、リポジトリ実装は `repository_impl`)
- 試行回数: 8(うち破棄 2)
- 関連 ADR: [ADR-0002](../adr/0002-backend-fastapi.md)、[ADR-0009](../adr/0009-backend-clean-architecture.md)
- 関連: —

## 問いの背景
LangGraph・Bedrock・モールの SDK が入れ替わっても、ユースケースを書き直さずに済むようにしたい。

## 試行
| 回 | 日付 | やったこと | 結果 | 判定 | 分かったこと | 次 | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | 2025-06-08 | TypeScript で `app/backend/` に domain/usecase/adapter/infrastructure を作る | — | 破棄(回2) | — | — | a066d52、db93610、9936183、bfdcce6 |
| 2 | 2026-06-09 | FastAPI/LangGraph の Python バックエンドを置く | — | 成功 | LangGraph・Bedrock・モール SDK を同じ言語に置く(ADR-0002) | 層を切る | 9a4150a |
| 3 | 2026-06-30 | `fastapi/backend` のクリーンアーキテクチャへ移す | — | 成功 | — | — | 160011a |
| 4 | 2026-07-02 | 永続化エンティティをやめ、`new_*` ファクトリ付きの値オブジェクトとドメインサービスにする | — | 成功 | 永続化をやめた(T-0002)後の整理 | — | ac8abea |
| 5 | 2026-07-02 | adapter をコントローラー/プレゼンターに分け、ドメインの実装を `domain_impl` に集める | — | 部分(回6) | — | LangGraph を外へ出す | b78d106 |
| 6 | 2026-07-02 | LangGraph を `gateways` に戻し、`domain_impl` はインターフェースの実装だけにする | — | 成功 | 外部連携と、それを組み合わせる実装は分ける | — | 06e5e7e |
| 7 | 2026-07-02 | リポジトリの IF を `entities` から `repositories` へ分ける | — | 破棄(同日に revert) | — | 実装側を分ける | 2d307ab → 6fa843c |
| 8 | 2026-07-02 | リポジトリの実装を `repository_impl` に分ける | — | 成功 | — | — | b93b1bb |

## いまの結論
現行の層の切り方になった。
