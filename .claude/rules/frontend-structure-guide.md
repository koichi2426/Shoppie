---
description: Frontend 構成詳細（App Router・hooks・components・Orval）
paths:
  - "nextjs/frontend/**/*.{ts,tsx,js,jsx,css}"
---

# Frontend 構成ガイド

短文: `.claude/rules/frontend-structure.md`。実装根: `frontend/`。iOS の `AgentHubApp/` は対象外。

## 再現チェックリスト

- [ ] Next.js App Router under `app/`
- [ ] 保護ルートは `(protected)/layout.tsx`（cookie 等でガード）
- [ ] ページは薄い `"use client"` + `hooks/useX`
- [ ] 機能 UI は `components/<feature>/`、プリミティブは `components/ui/`
- [ ] API は Orval → `gen/` + React Query；手編集禁止、更新は `npm run orval`
- [ ] 共通非 UI は `lib/`（`services/` 層は作らない）
- [ ] import は `@/` エイリアス

## ディレクトリ

```text
frontend/
  app/                 # routes + layouts + providers
  components/
    ui/                # shadcn only
    <feature>/         # screen sections
  hooks/               # useX（フラット）
  lib/                 # helpers / clients / env URLs
  gen/                 # Orval output
  types/               # 手書き ambient のみ
```

## App Router 例（AgentHub）

| URL | ファイル |
|-----|----------|
| `/` | `app/(protected)/page.tsx` |
| `/login` | `app/login/page.tsx` |
| `/:user/:agent` | `app/(protected)/[username]/[agentname]/page.tsx` |
| `.../finetuning/:job` | `.../finetuning/[jobid]/page.tsx` |

- ルート layout: font / theme / `Providers`（QueryClient + axios 共通設定）
- エージェントタブ: `?tab=&sub=` + `hooks/useAgentPageTabQuery` + `components/agent-tabs/`

## hooks

- ファイル名: `useThing.ts`（Provider が要るときだけ `.tsx`）
- export: named `useThing`
- 方針: 「ロジックは hooks、page は描画」
- 認証ガード・フォーム・ポーリング・URL 同期はここに置く

## components

- `ui/`: shadcn 追加はこの配下のみ（`components.json` 準拠）
- feature フォルダ: 画面ブロック単位（例: `finetuning/`, `deployments/`, `home/`）
- 横断 UI（header 等）は `components/` 直下でも可

## API / 状態

1. Prefer Orval hooks from `@/gen/...`
2. 複数ステップ・ポーリングは Orval 関数 + hooks 内制御
3. Orval 未対応だけ `lib/*Client.ts` で axios
4. React Query は `app/providers.tsx` で共通設定（auth ヘッダ注入含む）
5. グローバル Redux/Zustand は使わない。必要なら hooks 内 Provider

## 新規機能の置き方

1. ルートが必要 → `app/.../page.tsx`（薄く）
2. `hooks/useFeature.ts` に状態・API
3. UI → `components/<feature>/...`
4. バックエンド OpenAPI 更新後 → `npm run orval`
5. 純関数・定数 → `lib/`

## 典型パターン

```tsx
// app/(protected)/foo/page.tsx
"use client";
import { useFoo } from "@/hooks/useFoo";
import { FooPanel } from "@/components/foo/FooPanel";

export default function FooPage() {
  const vm = useFoo();
  return <FooPanel {...vm} />;
}
```

## 模範リポジトリ（お手本）

このリポジトリのフロントエンド構成（app + hooks + components + lib + gen）は AgentHub の実装を正としているが、以下は URL を貼るだけでなく、実際にコードを clone して中身を読み、Next.js App Router のディレクトリ構成として確認した内容である。

### vercel/platforms — マルチテナントの Server Action / Server Component

実ファイル構成（2026年時点。`middleware.ts` は既に `proxy.ts` へ移行済み）:

```text
app/
  actions.ts              # 'use server' の Server Action
  admin/{page.tsx, dashboard.tsx}
  s/[subdomain]/page.tsx  # 動的セグメント + Server Component
proxy.ts                   # ルート直下。旧 middleware.ts 相当（サブドメイン判定→rewrite）
lib/{redis.ts, subdomains.ts, utils.ts}
```

`app/actions.ts` は Server Action の典型形。`'use server'` を先頭に置き、`FormData` を受け取ってバリデーション → 外部ストア操作 → `redirect()` まで一気通貫で書く（抜粋）:

```typescript
"use server";
export async function createSubdomainAction(prevState: any, formData: FormData) {
  const subdomain = formData.get("subdomain") as string;
  if (!isValidIcon(icon)) {
    return { subdomain, icon, success: false, error: "..." };
  }
  const exists = await redis.get(`subdomain:${sanitizedSubdomain}`);
  if (exists) return { subdomain, icon, success: false, error: "This subdomain is already taken" };
  await redis.set(`subdomain:${sanitizedSubdomain}`, { emoji: icon, createdAt: Date.now() });
  redirect(`${protocol}://${sanitizedSubdomain}.${rootDomain}`);
}
```

`app/s/[subdomain]/page.tsx` は薄い async Server Component で、`params` を `Promise` として `await` し（Next 15 の規約）、データが無ければ `notFound()` を呼ぶだけ（抜粋）:

```tsx
export default async function SubdomainPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const subdomainData = await getSubdomainData(subdomain);
  if (!subdomainData) notFound();
  return ( /* ... */ );
}
```

ルーティングの分岐はルート直下の `proxy.ts`（`export async function proxy(request: NextRequest)`）で行っており、サブドメインを検出すると `NextResponse.rewrite(new URL(\`/s/${subdomain}\`, request.url))` して `app/s/[subdomain]/page.tsx` を配信する。`/admin` へはサブドメイン側からのアクセスを `NextResponse.redirect` で弾く。

**このプロジェクトへのマッピング:** 本プロジェクトの `app/(protected)/...` は「薄い `"use client"` + `hooks/useX`」を徹底しているのに対し、vercel/platforms の公開ページ（`app/s/[subdomain]/page.tsx`）は「薄い async Server Component が直接データ取得する」形をとる。認証不要な公開ページ・SEO 対象ページを今後追加する場合、無理に `"use client"` + hooks に寄せず、この Server Component パターンを使う選択肢がある。また `(protected)/layout.tsx` によるルートグループガードは、vercel/platforms の `proxy.ts` によるパスベースの制御（`/admin` へのアクセス拒否）と同じ「境界をルーティング層に集約する」考え方である。

### Blazity/next-enterprise — コンポーネント単位でのコロケーション

実ファイル構成（`src/` ディレクトリは無く、`app/`・`components/` はリポジトリ直下）:

```text
app/{api/health/route.ts, layout.tsx, page.tsx}
components/
  Button/{Button.tsx, Button.test.tsx, Button.stories.tsx}
  Tooltip/Tooltip.tsx
```

`components/Button/Button.tsx` は `class-variance-authority`（cva）でバリアントを定義する UI プリミティブの典型形（抜粋）:

```tsx
const button = cva(
  ["justify-center", "inline-flex", "rounded-xl", "border", "border-blue-400"],
  {
    variants: {
      intent: { primary: ["bg-blue-400", "text-white"], secondary: ["bg-transparent", "text-blue-400"] },
      size: { sm: ["min-w-20", "text-sm"], lg: ["min-w-32", "text-lg"] },
    },
    defaultVariants: { intent: "primary", size: "lg" },
  }
);
export function Button({ className, intent, size, underline, ...props }: ButtonProps) { /* ... */ }
```

**このプロジェクトへのマッピング:** 本ガイドの `components/ui/`（shadcn のみ）・`components/<feature>/`（画面ブロック単位）という分割に対し、next-enterprise は「コンポーネント名のフォルダの中にテスト・Storybook を同居させる」コロケーションを徹底している。`components/<feature>/` 配下のコンポーネントが増えて再利用・単体テストの需要が出てきたら、`FooPanel/{FooPanel.tsx, FooPanel.test.tsx}` のようにサブフォルダ化するのはこのリポジトリの慣習に沿った拡張と言える（現状の AgentHub 実装はこの粒度までは分けていない）。

### 参考リンク

- [vercel/platforms](https://github.com/vercel/platforms)
- [Blazity/next-enterprise](https://github.com/Blazity/next-enterprise)
