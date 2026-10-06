# T-0014: フロントと API を、どう配信するか

- 状態: 解決(Vercel(フロント)+ Render(API)。BFF なし)
- 試行回数: 5(うち破棄 1)
- 関連 ADR: [ADR-0010](../adr/0010-hosting-vercel-render-cloudflare.md)
- 関連: [T-0013](0013-app-icon.md)

## 問いの背景
個人開発なので、運用の小さい構成で速く回したい。障害の範囲は分けたい。

## 試行
| 回 | 日付 | やったこと | 結果 | 判定 | 分かったこと | 次 | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | 2026-06-30 | Next.js の API ルートを消し、フロントから FastAPI を直接呼ぶ | — | 成功 | — | — | abb017d |
| 2 | 2026-06-30 | モノレポ再編のあと、`frontend` → `nextjs/frontend` のシンボリックリンクを置き、Vercel の Root Directory を `frontend` のまま使う | — | 破棄(回3) | — | Root Directory を変える | 0a4310c |
| 3 | 2026-06-30 | シンボリックリンクを消し、Root Directory を `nextjs/frontend` にする | — | 成功 | — | — | b72b49d |
| 4 | 2026-07-01 | `www` からの CORS を許す | — | 成功 | — | — | 1df5eb6 |
| 5 | 2026-07-02 | アイコンの生成をビルドから外す | — | 成功 | Vercel のビルドには Pillow が無い | — | e2ecdb3 |

## いまの結論
Vercel+Render+Cloudflare、BFF なし。CI は無く、自動デプロイだけ。
