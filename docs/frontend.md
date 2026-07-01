# フロントエンド（Next.js）

## 概要

`nextjs/frontend/` は Next.js 15 App Router の SPA 的 UI です。Vercel にデプロイし、`NEXT_PUBLIC_API_URL` 経由で FastAPI を直接呼び出します。

## 画面構成

### ランディングモード

初回アクセス時:

- グラデーションタイトル「Shoppie」+ キャッチコピー「お買い物エージェント」
- Shoppie キャラクター（タップで音声入力）
- テキスト / 音声で最初の検索

最初の検索結果はランディング上にメッセージ + 商品グリッドで表示されます。

### チャットモード

2 回目以降の検索で、フルスクリーンチャット UI にスムーズ遷移します。

- 会話ターンごとにユーザー吹き出し → AI 吹き出し → 商品グリッド
- 下部に入力バー（テキスト + マイク）
- FAB（Shoppie キャラ）— タップで音声、長押しでドラッグ移動
- 「新しい会話」ボタン — Cookie と MemorySaver をリセット

## 主要コンポーネント

| パス | 役割 |
|------|------|
| `app/page.tsx` | ランディング + チャットの切り替え、全体オーケストレーション |
| `components/chat/chat-screen.tsx` | チャット UI |
| `components/chat/chat-product-card.tsx` | 商品カード + `ProductGrid` |
| `components/chat/chat-input-bar.tsx` | 入力バー |
| `components/chat/conversation-reset-button.tsx` | 新しい会話 |
| `components/shoppie/shoppie-hero-character.tsx` | ランディングのキャラ |
| `components/shoppie/shoppie-character-fab.tsx` | チャット時の FAB |
| `components/shoppie/shoppie-mascot.tsx` | マスコット SVG |

## カスタムフック

| フック | 役割 |
|--------|------|
| `use-search.ts` | API 呼び出し、会話ターン管理、`inChatMode` 制御 |
| `use-context-id.ts` | Cookie `shoppie_context_id`（UUID、7 日有効） |
| `use-speech-recognition.ts` | Web Speech API ラッパー |
| `use-character-hints.ts` | キャラの吹き出しヒント文言ローテーション |

## 商品表示 UI

`ProductGrid` コンポーネントで統一:

- **スマホ**: 1 列
- **PC（sm 以上）**: 2 列
- 各カードにモールバッジ（Yahoo / 楽天 / Amazon）
- 価格 0 円（Amazon 検索リンク等）は「Amazonで確認」と表示

## API クライアント

`lib/api.ts`:

```typescript
POST ${NEXT_PUBLIC_API_URL}/request-assistance
DELETE ${NEXT_PUBLIC_API_URL}/context/${contextId}
```

## 型定義

`types/api.ts` は OpenAPI 生成型（`gen/api.d.ts`）を re-export しています。

```bash
cd nextjs/frontend
npm run gen    # fastapi/openapi.json から型生成
```

`prebuild` で自動実行されるため、Vercel ビルド時も型が同期されます。

## 環境変数

`nextjs/frontend/.env.sample` を参照:

```
NEXT_PUBLIC_API_URL=https://api.shoppie-agent.com
```

## 音声入力

ブラウザの **Web Speech API**（`webkitSpeechRecognition`）を使用。非対応ブラウザではテキスト入力のみ。
