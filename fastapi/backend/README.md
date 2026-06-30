# Shoppie\_agent

**Shoppie\_agent**は、音声対話で商品検索ができるショッピングアプリ「Shoppie」における、LangChainベースのエージェント実装です。

---

## 概要

Shoppie\_agentは、ユーザーの発言を自然言語で受け取り、LangChainとClaude Haiku 4.5（Amazon Bedrock経由）を用いて、適切なツール実行と対話生成を行うエージェントです。APIと連携し、商品情報の取得と応答を自動化します。

---

## システム構成図

![image](https://github.com/user-attachments/assets/e0ffa911-0e67-412b-b047-ceb8f2128548)



---

## フロー詳細

1. **発話入力（FastAPI）**

   * ユーザーから音声またはテキストの発言を受信。
   * LangChainに渡される。

2. **思考判断（LangChain + Claude Haiku 4.5）**

   * LLMはMemoryを参照しながら、適切なツールの選択と、必要な入力形式への整形を行い、自動でツールを実行。

3. **ツール実行**

   * ツールの実行結果（例：商品リスト）がLLMに渡される。
   * LLMはこれを評価し、発話情報と商品情報を出力。

4. **応答生成と出力**

   * 最終的な応答（発話）と商品情報をFastAPIに返却。
   * Memoryに対話履歴が保存され、次回以降の発話判断に活用される。
