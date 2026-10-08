# T-0014: フロントと API を、どう配信するか

- 状態: 継続中(本番は Vercel + Render。AWS の API 検証と削除を完了)
- 試行回数: 8(うち失敗・破棄 2)
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
| 6 | 2026-10-08 | API の AWS 検証環境を ALB・ECS Fargate・RDS・ECR・IAM の Terraform で準備した | validate と mock provider の構成テスト3件が通過。AWS 認証は InvalidClientTokenId で失敗し、実リソースの作成は未実施 | 部分 | コードによる構成は検証できたが、AWS の実権限・接続・性能はまだ確認できていない | AWS にログインして検証環境を作成する | [構成と手順](../../infra/aws/README.md)、[ADR-0015](../adr/0015-aws-api-validation.md) |
| 7 | 2026-10-08 | ローカル Docker で Fargate 用イメージをビルドした | ビルドが失敗し、再試行では containerd のメタデータ書き込みが input/output error。端末の空き容量は約219MiB | 失敗 | 既存の Docker データを削除せずに、別のビルド環境が必要となった | 一時的な CodeBuild で linux/amd64 をビルドする | [レポート](../reports/20261008_aws-traffic-capacity.md)([HTML](../reports/20261008_aws-traffic-capacity.html)) |
| 8 | 2026-10-08 | 専用IAMの操作ロールから ALB・Fargate・RDS を作成し、CodeBuild のイメージで負荷比較した | 接続・会話共有・624件の負荷を確認。測定後にAWSリソースと専用IAMを削除 | 成功 | Terraform の構成が実アカウントで動作した。検証と本番移行は別段階で行う | 実APIとHTTPSの検証後に本番移行を判断する | [レポート](../reports/20261008_aws-traffic-capacity.md)([HTML](../reports/20261008_aws-traffic-capacity.html)) |

## 実験レポート

| 日付 | レポート | 関わる回 |
|---|---|---|
| 2026-10-08 | AWS の ALB・Fargate・RDS で1台と2台を比較([Markdown](../reports/20261008_aws-traffic-capacity.md) / [HTML](../reports/20261008_aws-traffic-capacity.html)) | 7・8 |

## いまの結論
現在の本番は Vercel + Render + Cloudflare、BFF なし。
ALB・ECS Fargate・RDS をAWSに作成し、模擬APIで1タスクと2タスクを比較した。測定後に検証用リソースと専用IAMを削除した。
構成コードとレポートは残し、本番切り替えはまだ実施していない。
