# ADR-0003: フロントは Next.js（App Router）の Web アプリにする

- ステータス: 採用
- 日付: 2026-10-02（記録日。判断はそれ以前。[technical-qa.md](../technical-qa.md) から起こした）

## 背景
「音声 → 検索 → 商品カード」の体験を、最短で出して仮説を検証したかった。

## 決定
Next.js 15（App Router）/ React 19 / Tailwind CSS 4 の Web アプリにし、Vercel で配信する。ネイティブアプリは作らない。

## 理由
- ランディング → 対話 UI → 商品グリッドを速く作れる。Vercel との親和性が高い
- ブラウザの Web Speech API で、追加費用なしに音声入力を試せる（[ADR-0007](0007-voice-web-speech-api.md)）

## 検討した代替案
| 案 | 良い点 | 見送った理由 |
|---|---|---|
| 素の React / Vite | SPA だけなら十分 | ルーティング・本番配信・将来の SSR は Next の方が楽 |
| Flutter などのアプリ | 端末の機能を使える | まず Web の音声入力で仮説を検証したかった |

## 影響・見直し条件
- フレームワークが厚い。ブラウザから FastAPI を直接呼ぶので CORS の設定が要る（[ADR-0010](0010-hosting-vercel-render-cloudflare.md)）
