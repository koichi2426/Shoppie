# ADR-0009: バックエンドはクリーンアーキテクチャで層を分ける

- ステータス: 採用
- 日付: 2026-10-02（記録日。判断はそれ以前。[technical-qa.md](../technical-qa.md)・[backend.md](../backend.md) から起こした）

## 背景
LangGraph・3 つのモール API・HTTP が混ざると、外部 API を差し替えにくくなる。

## 決定
`domain` / `usecase` / `adapter` / `infrastructure` に分ける。LangGraph はユースケースの裏（`infrastructure/gateways/langgraph`、
ドメインのインターフェースの実装は `infrastructure/domain_impl`）に閉じ込める。
ルールは `.claude/rules/clean-architecture.md`（ai-agent-templates の `web-app/llm-wrapper-service` を採用）。

## 理由
- HTTP とドメインを守り、外部 API の差し替えやすさを優先した

## 影響・見直し条件
- ファイルが増える
