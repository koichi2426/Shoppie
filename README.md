# Shoppie（ショッピー）｜話すだけで、買い物が進む

## Shoppieとは

**Shoppie** は、店員との会話のように自然な対話で商品を探せる
**音声ショッピングアプリ**です。
検索や操作の手間をなくし、話しかけるだけで楽天市場の商品が見つかります。

---

## 従来のショッピングが抱える課題

* 検索やカテゴリ選択など、手動操作が多く煩雑
* 欲しいものが曖昧だと、探しにくい
* スマートフォンやPCの操作が苦手な人には使いにくい
* 高齢者や視覚に不安のある人にとって情報取得のハードルが高い

---

## Shoppieによる解決

* 音声だけで商品検索が完結
* 曖昧なニーズにも自然言語で対応
* ボタン操作・タイピング不要のシンプルなUI
* LangChainによる文脈理解で、発言の流れを把握して提案

---

## 機能の特徴

* 音声による商品検索
  例：「洗えるスニーカーある？」など自然な会話形式で検索可能

* 楽天市場APIと連携
  価格、画像、レビュー、アフィリエイトリンクを取得して表示

* LangChainによる対話制御
  会話の意図や前後関係を理解し、カテゴリ提案や商品比較も実行

---

## 利用シーン

* 手がふさがっているときの“ながらショッピング”
* 高齢者や視覚に不安のあるユーザーへの支援
* 操作が苦手な人の声だけ買い物サポート
* 育児中や家事中のスキマ時間に検索
* 商品比較やカテゴリの絞り込みを対話で行いたいとき
* 雑談感覚で商品を探したいとき

---

## アプリ名の由来

「Chatty（おしゃべり）」と「Shopping（買い物）」を組み合わせた造語。
会話しながら買い物を楽しめる体験を表現しています。

---

## 技術構成
![image](https://github.com/user-attachments/assets/4af6dbea-0f66-41b8-87df-bd811b36c7bf)


```mermaid
graph TD
    subgraph "ユーザー"
        A[👤 ユーザー]
    end

    subgraph "Cloudflare - shoppie-agent.com"
        B[DNS / SSL / CDN / WAF]
    end

    subgraph "フロントエンド - Frontend"
        C[Vercel: Next.js App]
    end

    subgraph "バックエンド - Backend on AWS"
        D[Application Load Balancer - ALB] -- "HTTPS Port 443 to HTTP Port 8000" --> E
        subgraph "Amazon ECS - Fargate"
            E[Dockerコンテナ]
            subgraph E[" "]
                F[FastAPIサーバー]
                G[LangGraphエージェント]
            end
        end
    end
    
    subgraph "外部API - External APIs"
        H[AWS Bedrock - Claude 3 Haiku]
        I[Amazon Product Advertising API]
        J[Yahoo! Shopping API]
    end

    A -- "1. Visit [https://shoppie-agent.com](https://shoppie-agent.com)" --> B
    B -- "2. Show Frontend" --> C
    
    C -- "3. Frontend calls API (api.shoppie-agent.com)" --> B

    B -- "4. Forward to Backend" --> D
    F -- "5. Run Agent" --> G
    G -- "6. Think / Select Tool" --> H
    G -- "7. Execute Amazon Tool" --> I
    G -- "8. Execute Yahoo Tool" --> J
