# CLAUDE.md

Claude Code がこのリポジトリで作業する際のガイドです。詳細ルールは `.claude/rules/` にあり、触るパスに応じて自動的に読み込まれます。
規約は [koichi2426/ai-agent-templates](https://github.com/koichi2426/ai-agent-templates) の `web-app/llm-wrapper-service`(バックエンド)と `web-app/nextjs-python-clean-architecture`(フロントエンド)を採用しています。DB を持たないため RDB 系のルールは入れていません。

| ルール | 適用パス |
|---|---|
| `.claude/rules/clean-architecture.md` | 常時(詳細の `-guide` は `fastapi/backend/**/*.py`) |
| `.claude/rules/llm-wrapper-service.md` | 常時(詳細の `-guide` は `gateways/langgraph/**`・`domain_impl/**`・`usecase/**`) |
| `.claude/rules/ai-agent-context-engineering.md` | 常時(詳細の `-guide` は同上) |
| `.claude/rules/frontend-structure.md` | 常時(詳細の `-guide` は `nextjs/frontend/**`) |
| `.claude/rules/commit-message.md` | 常時 |
| `.claude/rules/worktree-per-pr.md` | 常時 |
| `.claude/rules/activity-record.md` | 常時(試行の記録・実験レポート) |

## Project Overview

「Shoppie(ショッピー)」— 店員と話すように、音声やテキストで商品を探せるショッピングエージェント(Web アプリ)。
曖昧な発話を LangGraph 上の LLM が解釈し、Yahoo!ショッピング・楽天市場・Amazon を横断検索して、短い返答と商品カードを返す。本番は https://shoppie-agent.com 。

## Tech Stack

### プロダクトの特色

- 「話すだけで買い物が進む」。検索ボックスやカテゴリ選択ではなく、会話そのものが検索の入口
- 会話 UI なので、1 往復のレイテンシと LLM の費用が体験を左右する。生成は短く、商品の詳細はカードに出す
- モール API の生レスポンスは大きい。LLM に全部渡すとトークンが膨らむので、画面に出すデータと LLM に渡すデータを分ける
- 曖昧な口語(「1万円以内で洗えるやつ」)を、モール API の構造化パラメータ(価格帯・ソート)に落とす必要がある
- ログインなしで会話を続けられる。秘密(モール・Bedrock のキー)はブラウザに出さない
- 個人開発。運用コストの小さい構成で速く回す

### 選定した技術と理由

| 項目 | 選定した技術 | 選んだ理由(プロダクトの特色との対応) | 検討した代替案 |
|---|---|---|---|
| フロントエンド | Next.js 15(App Router)/ React 19 / Tailwind CSS 4 | 音声 → 検索 → カードの体験を最短で出す。[ADR-0003](docs/adr/0003-frontend-nextjs-web-first.md) | 素の React / Vite、Flutter |
| バックエンド | FastAPI(Python)/ クリーンアーキテクチャ | LangGraph・Bedrock・モール SDK を同じ言語圏に置く。[ADR-0002](docs/adr/0002-backend-fastapi.md)・[ADR-0009](docs/adr/0009-backend-clean-architecture.md) | Django、Nest / Node、Next.js だけで完結 |
| エージェント | LangGraph(LLM 1 ノード + ツールノード + スキーマ拘束) | 推論をツールの境界で拘束する。[ADR-0004](docs/adr/0004-langgraph-tool-loop.md) | 単発の LLM 呼び出し、固定 API + クエリ文字列 |
| LLM | AWS Bedrock — Claude Haiku 4.5(`max_tokens=256`) | 短い店員口調とツール選択で十分。速く安い。[ADR-0005](docs/adr/0005-llm-bedrock-claude-haiku.md) | より大きいモデル |
| LLM に渡す文脈 | 三経路のデータ設計(画面はフル・LLM は商品名・価格・モールとレビュー・送料・商品状態) | 件数を保ち、測定した4構成のうち選択成功が最も多かった構成を標準にする。[ADR-0011](docs/adr/0011-three-path-data.md) | 件数を間引く |
| 会話の文脈 | LangGraph `MemorySaver`(プロセス内)+ Cookie の UUID | 最小構成で対話を閉じる。[ADR-0006](docs/adr/0006-session-memorysaver.md) | Redis checkpointer、Postgres |
| 音声入力 | Web Speech API(タップで起動) | 追加費用なしで検証。[ADR-0007](docs/adr/0007-voice-web-speech-api.md) | Whisper / Deepgram、常時聞き取り |
| 商品検索 | Yahoo v3 / 楽天 Ichiba / Amazon Creators API(PA-API 後方互換) | 横断検索が会話 UI の強み。[ADR-0008](docs/adr/0008-multi-marketplace.md) | 単一モール |
| API の型 | OpenAPI → openapi-typescript(`gen/`) | エンドポイントが少なく型だけで十分。[ADR-0012](docs/adr/0012-openapi-typescript.md) | Orval + React Query |
| 配信 | Vercel(フロント)+ Render(Docker の API)+ Cloudflare。BFF なし | 障害の範囲を分け、経路を単純に。[ADR-0010](docs/adr/0010-hosting-vercel-render-cloudflare.md) | Next.js API Routes を BFF に |
| ユーザーの反応の計測 | 往復の `turn_id` と構成の `config_version` に結び付けた構造化ログ(`POST /events`) | 構成ごとに本番の反応を比べる。外部サービス・DB を足さずに始める。[ADR-0014](docs/adr/0014-interaction-events-log.md) | GA4、Vercel Web Analytics、DB に保存 |
| データベース | なし | 会話は短命でよい。永続化が要るものがない | Redis、Postgres |
| 認証 | なし(`context_id` はスレッドのキーで秘密ではない) | ログインなしで使える | — |
| CI/CD | なし(Vercel・Render の自動デプロイのみ) | — | GitHub Actions |

### 見直しの記録

- 2026-10-09: セキュリティ監査(ソースのみ、quick)で出た要検証の候補のうち 3 件を直した。LLM に渡す会話を直近 6 往復に限った([ADR-0019](docs/adr/0019-llm-history-window.md))。モール検索の通信例外から認証情報が流れないようにした。Supabase への DB 接続で証明書とホスト名を検証するようにした([T-0018](docs/trials/0018-anonymous-surface-protection.md))
- 2026-10-08: ユーザーの反応(商品カードのクリック・会話のリセット)を、往復と構成の識別子に結び付けて構造化ログに記録し始めた。発話の本文は記録しない([ADR-0014](docs/adr/0014-interaction-events-log.md)、[T-0016 回1](docs/trials/0016-KEY-user-feedback-loop.md))
- 2026-10-06: LLM に共有する商品名・価格・モールに、ツール出力にあるレビュー・送料・商品状態を追加した。4構成の比較で入力69.0%削減、最安選択23/38回だった構成を暫定標準にした([ADR-0011](docs/adr/0011-three-path-data.md)、[T-0003 回8](docs/trials/0003-KEY-llm-context.md))
- 時期不明(2026-10-02 に記録): 音声入力を常時聞き取り → タップで起動・検索中はマイク停止に変更([ADR-0007](docs/adr/0007-voice-web-speech-api.md))
- 時期不明(2026-10-02 に記録): 画面に出す商品を「最大 10 件に厳選」→「件数制限なし」に変更([ADR-0011](docs/adr/0011-three-path-data.md))
- 2026-10-05: 試行を問いごとに記録し始めた。それ以前の試行は git 履歴から起こした([ADR-0013](docs/adr/0013-trials-record.md)、[docs/trials/](docs/trials/README.md))
- 2026-10-02: 設計判断を ADR で記録し始めた。それ以前の判断は `docs/technical-qa.md` から起こした([ADR-0001](docs/adr/0001-record-architecture-decisions.md))

## Commands

バックエンド(`fastapi/backend`):
- Install: `pip install -r requirements.txt`
- Dev: `PYTHONPATH=. uvicorn main:app --reload --port 8000`(Docker なら `fastapi/` で `docker compose up`)
- Test: `PYTHONPATH=. python -m pytest -q`
- OpenAPI の書き出し: `PYTHONPATH=. python scripts/export_openapi.py`(`fastapi/openapi.json` を更新)
- 環境変数: `fastapi/.env.sample` を `fastapi/.env` にコピーして値を入れる

フロントエンド(`nextjs/frontend`):
- Install: `npm install`
- Dev: `npm run dev`(`.env.local` に `NEXT_PUBLIC_API_URL=http://localhost:8000`)
- Build: `npm run build`(`prebuild` で `npm run gen` が走る)
- Lint: `npm run lint`
- API の型生成: `npm run gen`(`fastapi/openapi.json` → `gen/api.d.ts`)

## Architecture

全体像は [docs/architecture.md](docs/architecture.md)、設計判断は [docs/adr/](docs/adr/README.md)、試行の記録は [docs/trials/](docs/trials/README.md)、実験レポートは [docs/reports/](docs/reports/README.md)、選定理由の Q&A は [docs/technical-qa.md](docs/technical-qa.md)。

- リクエストの流れ: ブラウザ → `POST /request-assistance`(`text` + `context_id`)→ LangGraph(Bedrock がツールを選び、モールを並列検索)→ 短い返答 + 商品
- バックエンドは `domain` / `usecase` / `adapter` / `infrastructure`。LangGraph は `infrastructure/gateways/langgraph`、モールは `infrastructure/gateways/{yahoo,rakuten,amazon}`
- LLM には `messages_for_llm` で直近 6 往復の会話と、直近のツール結果の全件を渡す([ADR-0019](docs/adr/0019-llm-history-window.md))。商品ごとに `title`(80文字まで)、`price_yen`、`marketplace` と、元データにある `review_rate`・`review_count`・`shipping`・`condition` を共有し、欠損値は補わない。画面にはフルの商品データを返す
- ユーザーの反応は `POST /events` と往復の結果を `interaction_event {JSON}` の 1 行でログに出す。集計は `scripts/aggregate_interaction_events.py`
- フロントは `app/`(薄い page)+ `hooks/` + `components/{chat,shoppie}` + `lib/`。履歴は持たず、毎回「今回の発話 + context_id」だけ送る

### テンプレート規約との差(既知の例外)

`.claude/rules/` はテンプレートの本文をそのまま入れている。次の点は Shoppie の判断が優先する。直すときは ADR を更新してから。

| 規約 | Shoppie の現状 | 根拠 |
|---|---|---|
| `llm-wrapper-service.md`: ステートレスにし、会話状態は Redis/RDB に置く | `MemorySaver`(プロセス内)・Gunicorn 1 ワーカー | [ADR-0006](docs/adr/0006-session-memorysaver.md)。ワーカーや台数を増やす前に Redis へ移す |
| `llm-wrapper-service.md`: 複数プロバイダ・フォールバック・トークン単位のレート制限・SSE | Bedrock のみ。レート制限は薄い。ストリーミングなし | [ADR-0005](docs/adr/0005-llm-bedrock-claude-haiku.md)。今後の課題 |
| `llm-wrapper-service.md`: クライアントに自社発行の短命トークン | 認証なし。Cookie の UUID はスレッドのキー | [ADR-0006](docs/adr/0006-session-memorysaver.md) |
| `frontend-structure.md`: Orval → `gen/`、`components/ui/` は shadcn | openapi-typescript → `gen/`。shadcn は使っていない | [ADR-0012](docs/adr/0012-openapi-typescript.md) |

新しく書くコードは、これらの例外を広げない(例: 新しいプロセス内の状態を増やさない)。

## Code Style / Conventions

- コメント・ドキュメント・コミットメッセージは日本語。コメントは「何をしているか」より「なぜそうしているか」を書く
- Python: クリーンアーキテクチャの依存方向を守る(`.claude/rules/clean-architecture.md`)。値オブジェクトは `domain/value_objects/` に置き、生成時に検証する
- TypeScript: import は `@/` エイリアス。`gen/` は手で編集しない
- コミットは Conventional Commits(type・scope は英語、件名・本文は日本語。`.claude/rules/commit-message.md`)

## Testing

- バックエンド: pytest。テストは対象の隣に `test_*.py` で置く(`domain/test_domain_objects.py`、`usecase/test_usecases.py`、`infrastructure/gateways/**/test_*.py`)
  - 既知の問題: `gateways/yahoo/test_yahoo_api.py`・`gateways/rakuten/test_rakuten_api.py` は `from yahoo_api import ...` のように書かれていて、`PYTHONPATH=.` では import できず収集時にエラーになる(2026-10-02 時点)
- フロントエンド: 自動テストはない。`npm run lint` と `npm run build`(型チェックを含む)を通す
- API を変えたら: バックエンド → `export_openapi.py` → `npm run gen` → フロントの実装、を同じ PR で行う

## Notes for AI Agents

- `.claude/rules/` 配下は必ず遵守すること。上の「既知の例外」以外で規約から外れる変更をするなら、先に ADR を書く
- **コードを変えたら、同じ作業の中で `docs/trials/` の該当する問いに 1 行足す**(失敗・戻した試行も。`.claude/rules/activity-record.md`)。書き忘れは Stop hook が差し戻す。測って判断したら `docs/reports/` にレポートを書き、問いの回に紐付ける
- **技術判断をしたら `docs/adr/` に記録する**(テンプレートは `docs/adr/0000-template.md`、一覧は `docs/adr/README.md`)。判断を変えたら経緯を残し、上の「見直しの記録」にも追記する
- 新しい PR は専用の git worktree で作る(`.claude/rules/worktree-per-pr.md`)。マージはオーナーの OK を待つ
- 本番(Vercel・Render・Cloudflare)の設定変更・環境変数の変更・手動デプロイは、必ず人間の確認を取ってから行う
- LLM のモデル・`max_tokens`・プロンプト・ツールスキーマの変更は、費用とレイテンシに直結する。変えるときは理由を PR に書く
- モール API の利用規約(アフィリエイトの表示・リンクの扱い)を守る。商品データを LLM の出力で書き換えて表示しない
- `.env`・`.env.local`・API キー・アフィリエイト ID はコミットしない
- `nextjs/frontend/gen/` は生成物。`npm run gen` で作り直す
