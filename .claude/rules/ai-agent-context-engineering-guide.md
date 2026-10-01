---
description: AIエージェントのコンテキスト構築詳細(キャッシュ・RAG・圧縮・トークン肥大化の防ぎ方)
paths:
  - "fastapi/backend/infrastructure/gateways/langgraph/**/*.py"
  - "fastapi/backend/infrastructure/domain_impl/**/*.py"
  - "fastapi/backend/usecase/**/*.py"
---

# AIエージェント コンテキスト構築 詳細ガイド

短文: `.claude/rules/ai-agent-context-engineering.md`(毎回適用)。
実例: 会話履歴・ツール定義・長期記憶検索を毎回LLMに組み立てて渡すオーケストレーション層(プロバイダを問わず必要になる構成)。

## 背景

LLMは呼び出すごとにステートレスだが、会話が続いているように見えるのは、こちら側が毎回リクエストを「system prompt + ツール定義 + 会話履歴 + 今回の入力」から組み立てて送っているからにすぎない。これを工夫しないと、会話が伸びるほど1リクエストのトークン数が肥大化し、以下が同時に悪化する:

1. **コスト**(課金は使用量に比例)
2. **プロバイダのレート制限抵触頻度**(TPM = 1分あたりトークン上限。少ないターン数で到達する)
3. **応答精度**("lost in the middle" — コンテキストが長いほどモデルが途中の情報を見落としやすくなる)

実例として起きがちな失敗: 会話履歴の直近ウィンドウに上限を設定し忘れると、長い雑談が続くほど1メッセージが18,000〜20,000トークンまで膨張し、プロバイダ側のTPM制限(例: Tier 1で30,000/分)に頻繁に当たって機能しなくなる。原因の多くは「ウィンドウ長を決める設定値」が未設定時にデフォルトで無制限(0扱い)になっていること。

## 今プロジェクトへの再現チェックリスト

- [ ] system prompt・ツール定義など不変部分をリクエストの先頭に固定し、prompt cachingが効く形にする
- [ ] 会話履歴(直近ウィンドウ)に**必ずデフォルトで有効な上限**を持たせる。env未設定なら無制限を許さない
- [ ] 直近ウィンドウからも溢れた古いやり取りは、要約して持ち帰るか、埋め込み検索(RAG)/長期記憶で必要な時だけ引く
- [ ] ツール定義はそのエージェント・その場面で有効なものだけを渡す。静的に結びつけた全ツールを常時LLMに送信しない
- [ ] 1リクエストあたりの実トークン数を計測・ログできるようにする(使用量ログテーブル・カウンタ)
- [ ] 会話履歴・ツール定義の上限値はコードのデフォルトで安全側に倒す(env変数任せにして、設定を忘れると無制限、にしない)

## 3つの技術(詳細)

### 1. Prompt Caching(キャッシュ)

system prompt・ツール定義などリクエストをまたぎほぼ不変な部分をプロンプトの先頭に固定して送ると、対応するプロバイダ側でキャッシュされ、そのぶんコスト・レイテンシが大幅に下がる(目安50〜90%)。ただし多くの実装で**TPM等のレート制限自体はキャッシュ有無に関わらずトークン数でカウントされる**点に注意。
→ キャッシュは主にコスト対策であり、レート制限対策の本命は次の「選択」「圧縮」。

### 2. 選択的コンテキスト注入(RAG)

会話全履歴を毎回そのまま送らず、直近の短いウィンドウ(例: 直近10〜20ターン)だけを生の文脈として送る。それより古い内容は埋め込み検索で、今の話に関係あるものだけをその都度引いてくる(episodic memory検索に相当)。

### 3. 圧縮(Compaction)

直近ウィンドウからも溢れた古いやり取りを、捨てるのではなく要約して持ち帰る(または上記のRAGに任せて「必要になったら検索で戻ってこられる」状態にする)。長期タスクでは、区切りごとに要約してから次のフェーズに進む(コンテキストを綺麗な状態に戻す)パターンを定石とする。

## 「LLM推論サーバー」と「エージェントのオーケストレーション層」を混同しない

ChatGPT/Geminiなどの少数の巨大モデルインスタンスに全世界のリクエストを continuous batching で相乗りさせるアーキテクチャは、**モデルの重みがGPU上で実際に動く推論サーバー層**の話である。プロンプトの内部にはそのバッチングは存在せず、外部からそのAPIをHTTPで叩くだけの側(プロンプトを組み立て・ツール呼び出し・会話状態管理を行うオーケストレーション層)は、その推論バッチングには一切関与しておらず、酷似も意味しない。LLM API自体は**呼び出すごとにステートレス**である。会話が続いているように見えるのは呼び出し側が毎回コンテキストを組み立てて送っているからにすぎない(このガイドの本題)。

オーケストレーション層自身のテナント(エージェント/ユーザー)をどう分離してスケールするかは別の「正当な設計論点」で、2026年時点の実践パターンは主に3つ:

1. **専用コンテナ/プロセス方式**: テナントごとに完全隔離。実装がシンプルで秘密鍵・ペルソナの漏洩リスクが低いが、テナント数が増えるとインフラコストと起動待ちが線形に増える
2. **共有ワーカープール方式**: 1プロセス群を全テナントで共有しコスト効率が良いが、**テナントIDをキュー・ツール実行レベルで厳密に強制する必要がある**(プロンプト内の指示だけでテナント分離するのは不十分。プロンプトインジェクションで容易に破られる)
3. **ハイブリッド型(セッション単位の軽量隔離)**: 例えばAWS Bedrock AgentCoreはセッションごとに軽量microVMを使い捨てで起動し、VMのコスト・レイテンシを避けつつ隔離を保つ

**移行の判断基準**: レート制限やコストの問題は基本的にこの層の選択とは無関係(LLM側APIキーの上限に紐づくため)。専用コンテナ方式を捨てる契機になるのは、エージェント数の増加に伴うインフラコスト(起動待ち)が実際に痛み始めたところで、それまでは秘密情報漏洩リスクが低い専用コンテナ方式を維持する方が安全側に倒れる。

### 参考文献

- [Multi-Tenant AI Agent Architecture: Design Guide (2026) — Fastio](https://fast.io/resources/ai-agent-multi-tenant-architecture/)
- [Multi-Tenant AI Agent Architectures: Isolation, Routing, and Data Safety — Omnithium](https://omnithium.ai/blog/multi-tenant-agent-architecture.html)
- [Building multi-tenant agents with Amazon Bedrock AgentCore — AWS](https://aws.amazon.com/blogs/machine-learning/building-multi-tenant-agents-with-amazon-bedrock-agentcore/)
- [Multi-tenant agentic AI system — Google Cloud Architecture Center](https://docs.cloud.google.com/architecture/multi-tenant-agentic-ai-system)
- [Are LLMs Stateless? Architecture, Implications and Solutions — Atlan](https://atlan.com/know/are-llms-stateless/)
- [Deploying AI Agents to Production: Architecture, Infrastructure, and Implementation Roadmap — MachineLearningMastery.com](https://machinelearningmastery.com/deploying-ai-agents-to-production-architecture-infrastructure-and-implementation-roadmap/)
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Effective harnesses for long-running agents — Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
