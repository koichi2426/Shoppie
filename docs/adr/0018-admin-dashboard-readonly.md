# ADR-0018: 管理者画面は Next.js のサーバー側から読み取り専用ロールで Supabase を読む

- ステータス: 採用（ローカルで Supabase 接続を検証済み。Vercel の環境変数はまだ設定していない）
- 日付: 2026-10-08
- 関連: [T-0016](../trials/0016-KEY-user-feedback-loop.md)、[ADR-0017](0017-supabase-interaction-events.md)、[ADR-0010](0010-hosting-vercel-render-cloudflare.md)

## 背景

ADR-0017 で会話履歴と反応イベントを Supabase に保存し始めた。構成ごとの指標・会話の本文・反応イベントを確認する手段が、SQL を直接書くか、ログを書き出して集計スクリプトを回すことしかない。会話の本文を含むため、見られるのは管理者だけにする必要がある。

ADR-0010 は「BFF なし」で、Next.js からバックエンドへは直接 API を呼ぶ構成にしている。

## 決定

`/admin` に管理者画面を置き、Next.js の Route Handler（`app/api/admin/*`、Node.js ランタイム）から Supabase を直接読む。Render のバックエンドは経由しない。

- DB は専用ロール `shoppie_admin_reader` で接続する。`shoppie_analytics` の 2 テーブルへの `SELECT` と、SELECT だけの RLS ポリシーを持つ（[マイグレーション](../../infra/supabase/migrations/202610080003_admin_reader.sql)）。接続側でも `default_transaction_read_only=on` と `statement_timeout` を付ける
- TLS は検証を切らずに、Supabase のルート CA（`Supabase Root 2021 CA`）だけを信頼する。CA は公開証明書としてコードに同梱する
- 認証は環境変数の 1 アカウント（`ADMIN_USERNAME`・`ADMIN_PASSWORD`）と、`ADMIN_SESSION_SECRET` で HMAC 署名した 8 時間の Cookie（`HttpOnly`・`SameSite=Strict`・本番は `__Host-`）。ログインとログアウトは同一オリジンの POST だけ受け付ける
- 接続文字列・パスワードはサーバー専用の環境変数に置き、`NEXT_PUBLIC_` を付けない。`server-only` で、DB と認証のモジュールがブラウザ向けのバンドルに入らないようにする

この Route Handler は管理者画面の読み取り専用で、利用者の会話の経路（ブラウザ → Render）は変えない。ADR-0010 の「BFF なし」は会話 API についての判断として維持する。

## 理由

- バックエンドに管理用のエンドポイントを足すと、利用者向けの API と同じプロセスに会話本文を返す口ができる。管理者画面を分けると、会話の経路に手を入れずに済み、Render の再起動中でも保存済みのデータを見られる
- 読み取り専用ロールにすると、Vercel 側の接続情報が漏れても書き込み・削除はできない（ローカルで DELETE が `InsufficientPrivilege` になることを確認した）
- 個人開発で管理者は 1 人。外部の認証サービスを足すより、環境変数の 1 アカウントで始めるほうが運用が小さい

## 検討した代替案

| 案 | 良い点 | 見送った理由 |
|---|---|---|
| FastAPI に管理用 API を足す | クリーンアーキテクチャの層に乗る。DB 接続が 1 か所 | 利用者向け API と同じプロセスに会話本文を返す口ができる。Render の停止中は見られない |
| Supabase のダッシュボード・SQL エディタで見る | 実装が要らない | 構成ごとの指標を毎回 SQL で書く必要がある |
| Supabase Auth でログイン | 多要素認証などが使える | 管理者 1 人に対して依存と設定が増える |
| TLS の検証を切る（`rejectUnauthorized: false`） | 設定が要らない | 経路上のなりすましを検出できない |

## 影響・見直し条件

- Vercel に `ADMIN_DATABASE_URL`・`ADMIN_USERNAME`・`ADMIN_PASSWORD`・`ADMIN_SESSION_SECRET` を設定する必要がある
- ログイン試行の回数制限は持たない。パスワードは 16 文字以上を必須にしている。管理者が増える、または不審なログイン試行が見えたら、回数制限か外部の認証に移す
- Supabase の CA が更新されたら（現行は 2031-04-26 まで）、同梱の証明書を差し替える
