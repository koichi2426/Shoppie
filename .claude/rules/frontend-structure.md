---
description: Frontend ファイル設計（毎回適用・他プロジェクト再現用）
---

# Frontend ファイル設計（必守）

詳細は `.claude/rules/frontend-structure-guide.md`（`nextjs/frontend/**` 作業時に paths でロード）。  
目標: Next.js App Router の薄い page + hooks + components + lib + gen を **同じ形で再現**する。

## レイヤ（依存の向き）

```text
app/**/page.tsx （薄い・表示と組み立て）
    → hooks/useX.ts （状態・API・ハンドラ）
        → @/gen（Orval） / lib/（純関数・薄いクライアント）
    → components/<feature>/ （機能 UI）
        → components/ui/ （shadcn プリミティブのみ）
```

## 置き場所

| 置き場 | 入れるもの |
|--------|------------|
| `app/` | ルート・layout。ロジックは書かない（hooks に出す） |
| `hooks/` | `useX`。ページ／機能の状態と副作用 |
| `components/ui/` | shadcn/Radix だけ |
| `components/<feature>/` | 機能 UI（agent-tabs, finetuning, deployments…） |
| `lib/` | 純関数・env/URL・手書き axios 薄いラッパ。**`services/` は作らない** |
| `gen/` | Orval 生成物。**手編集禁止** → `npm run orval` |

## ルーティング

- App Router（`pages/` は使わない）
- 認証エリアは `(protected)` ルートグループ + layout でガード
- 動的セグメントは `[param]`（小文字）
- タブ UI はクエリ（`?tab=`）優先。タブごとに深いネスト route を増やさない

## 禁止

- `page.tsx` に fetch／巨大 state マシンを直書き
- `gen/` の手編集
- ネイティブアプリ（例: `AgentHubApp/`）と Web フロントのコード共有前提
