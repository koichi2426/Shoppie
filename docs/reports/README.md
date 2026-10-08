# 実験レポート一覧

測って判断した実験を、1 つの実験(または同じ問いの繰り返し)につき 1 本にまとめる。
書式は [0000-template.md](0000-template.md)。同じ名前の `YYYYMMDD_<slug>.md` と `YYYYMMDD_<slug>.html` をセットで作成する。

Markdownを正本にし、HTMLにも同じ条件・数値・結論・限界・出典・再現手順を載せる。本文を更新したらHTMLも再生成する。

```sh
python3 -m pip install -r scripts/requirements-report.txt
python3 scripts/render_experiment_report.py docs/reports/YYYYMMDD_<slug>.md
```

生成したHTMLをブラウザで開き、表・グラフ・データへのリンクを確認する。図はHTMLに埋め込まれ、データとコードへのリンクは元の相対パスを維持する。

何をレポートにするか: レイテンシ・入力/出力トークン数・Bedrock の費用・ツール選択の当たり方・モール API の 0 件率・音声認識の失敗率など、**数字を見て何かを決めた**作業。
数字を見ずに入れた変更は、レポートにせず試行の記録(`docs/trials/`)の 1 行だけでよい。

## 試行の記録への紐付け(全レポート共通・必守)

**すべての実験レポートは、試行の記録([`docs/trials/`](../trials/README.md))のどれかの問いの回に紐付ける。** 紐付け先の無いレポートを作らない。

- レポート冒頭の「記録」に、問いの番号と回を書く(例: T-0003 回6)
- その問いのファイルの試行表に回を足し、根拠の欄からレポートへリンクする
- その問いのファイルの「実験レポート」の表に、日付順で 1 行足し、「関わる回」を埋める
- この一覧の「試行の記録」の列に問いの番号を書く
- レポート一覧と問いの「実験レポート」に、Markdown版とHTML版の両方のリンクを置く
- 合う問いが無ければ、[`.claude/rules/activity-record.md`](../../.claude/rules/activity-record.md) に従って問いを新設してから書く

## 使ったデータ

どのレポートにも「使ったデータ」の節を置き、読んだ人が同じ数字を出し直せるようにする。

| 種類 | 置き方 |
|---|---|
| 入力(発話の一覧・評価用の会話) | `docs/reports/data/<レポート名>/` に置いてリンクする。1 ファイル 2 MiB まで |
| 計測結果 | JSON・CSV を同じ場所に置いてリンクする |
| 実行したコード | スクリプトへのリンクとコミットのハッシュ |
| 本番のログ | 写さない。期間と抽出の条件を書く |

**ユーザーの発話・Cookie の ID・API キー・アフィリエイト ID は入れない。** 本番の発話を使うときは、個人を特定できる内容を除いてから置く。

| 日付 | 問い | 結論 | 試行の記録 | レポート |
|---|---|---|---|---|
| 2026-10-06 | 商品フィールドの量と条件付きの商品選択 | 実験時の最小フィールドは入力73.3%削減・価格の最安選択9/10回。レビュー・送料等の追加は入力69.0%削減・全条件23/38回で、暫定標準に採用 | [T-0003](../trials/0003-KEY-llm-context.md) 回6・7・8 | [Markdown](20261006_tool-payload.md) / [HTML](20261006_tool-payload.html) |
| 2026-10-08 | グラフの実行を別スレッドに移したときの同時接続の待ち時間 | 偽物の外部サービスで、最後の人の待ち時間が10人同時で35.30秒→3.56秒、30人同時で105.94秒→10.63秒。30人ではスレッドの上限12で3段に分かれた | [T-0017](../trials/0017-KEY-traffic-capacity.md) 回2 | [Markdown](20261008_agent-concurrency.md) / [HTML](20261008_agent-concurrency.html) |
| 2026-10-08 | PostgreSQL の共有会話と1・2プロセスの負荷比較 | 2つの API と再起動後で会話を継続。同時30件の最大は10.913秒→7.204秒。AWS上は未測定 | [T-0002](../trials/0002-KEY-conversation-state.md) 回12・13、[T-0017](../trials/0017-KEY-traffic-capacity.md) 回3 | [Markdown](20261008_shared-conversation-postgres.md) / [HTML](20261008_shared-conversation-postgres.html) |
| 2026-10-08 | AWS の ALB・Fargate・RDS による会話共有と1・2台比較 | 624件全件成功。同時60件の最大35.869秒→18.127秒。検証用AWS・専用IAMは削除 | [T-0017](../trials/0017-KEY-traffic-capacity.md) 回4、[T-0002](../trials/0002-KEY-conversation-state.md) 回14、[T-0014](../trials/0014-hosting.md) 回7・8 | [Markdown](20261008_aws-traffic-capacity.md) / [HTML](20261008_aws-traffic-capacity.html) |
| 2026-10-08 | Supabase 向け反応イベント保存 | 人工イベント3件を再起動後も読み出し、既存集計を確認。Supabase・Render本番接続はまだ実施していない | [T-0016](../trials/0016-KEY-user-feedback-loop.md) 回2・回3 | [Markdown](20261008_supabase-interaction-events.md) / [HTML](20261008_supabase-interaction-events.html) |
