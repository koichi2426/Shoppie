# 設計判断の記録（ADR）

「なぜこの技術・この構成にしたか」を、判断したその時点で 1 件 1 ファイルで残す。
後から読む人（未来の自分や AI エージェントを含む）が、前提が変わったときに見直せるようにするため。

- 書式は [0000-template.md](0000-template.md)。番号は連番、一度採用したものは消さずに「置き換え」で更新する
- 途中で判断を変えたときは、経緯（何から何に、なぜ）を残す
- 0002〜0012 は、ADR を始める前の判断を [technical-qa.md](../technical-qa.md) などから起こしたもの

| # | 判断 | 状態 |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | 設計判断を ADR で記録する | 採用 |
| [0002](0002-backend-fastapi.md) | バックエンドは FastAPI（Python） | 採用 |
| [0003](0003-frontend-nextjs-web-first.md) | フロントは Next.js（App Router）の Web アプリ | 採用 |
| [0004](0004-langgraph-tool-loop.md) | エージェントは LangGraph の「LLM 1 ノード＋ツールノード」 | 採用 |
| [0005](0005-llm-bedrock-claude-haiku.md) | LLM は Bedrock の Claude Haiku 4.5、生成は短く | 採用 |
| [0006](0006-session-memorysaver.md) | 会話の文脈はプロセス内の MemorySaver。DB・Redis・認証なし | DB 設定時は0015へ置き換え |
| [0007](0007-voice-web-speech-api.md) | 音声入力は Web Speech API、タップで起動 | 採用 |
| [0008](0008-multi-marketplace.md) | Yahoo・楽天・Amazon を横断検索 | 採用 |
| [0009](0009-backend-clean-architecture.md) | バックエンドはクリーンアーキテクチャ | 採用 |
| [0010](0010-hosting-vercel-render-cloudflare.md) | Vercel + Render + Cloudflare、BFF なし | 採用 |
| [0011](0011-three-path-data.md) | 画面・LLM・チェックポイントに渡すデータを分ける | 採用 |
| [0012](0012-openapi-typescript.md) | API の型は openapi-typescript で生成 | 採用（規約の例外） |
| [0013](0013-trials-record.md) | 試行は ADR と分けて、問いごとの記録（docs/trials/）に残す | 採用 |
| [0014](0014-interaction-events-log.md) | ユーザーの反応は往復の識別子に結び付けて構造化ログに記録する | 採用 |
| [0015](0015-shared-postgres-checkpoints.md) | 会話チェックポイントと最終アクセスを PostgreSQL で共有する | 採用（ローカル・AWS検証済み） |
| [0016](0016-aws-api-validation.md) | API の AWS 検証環境は ALB・ECS Fargate・RDS | 採用（AWS検証・削除済み） |
| [0017](0017-supabase-interaction-events.md) | 会話履歴と反応イベントを Supabase の PostgreSQL に保存する | 採用（Supabase保存検証済み） |
