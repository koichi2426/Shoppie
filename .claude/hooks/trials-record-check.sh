#!/usr/bin/env bash
# コードを変えたのに docs/trials/ に試行を記録していなければ、停止を差し戻す。
#
# .claude/rules/activity-record.md は「変えたら同じ作業の中で docs/trials/ に
# 1 行足す」を求める。失敗した試行ほど書き忘れるので、機械で止める。
# AgentHub の同名の hook を Shoppie のディレクトリ構成に合わせて移したもの。
#
#   start: SessionStart で呼ぶ。セッション開始時の HEAD を .git/ に控える
#   check: Stop で呼ぶ。開始時からのコミットと作業ツリーの両方を見る
#
# 差し戻しは 1 回だけ(stop_hook_active のときは通す)。問いを持たない作業
# (誤字・整形など)なら、Claude がその旨を述べて終われるようにするため。
set -uo pipefail
mode="${1:-check}"
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

input=$(cat 2>/dev/null || true)
field() { printf '%s' "$input" | python3 -c "import json,sys
try: print(json.load(sys.stdin).get('$1',''))
except Exception: print('')" 2>/dev/null; }
sid=$(field session_id); sid=${sid:-unknown}
base_file="$(git rev-parse --git-dir)/claude-trials-base-${sid}"

if [ "$mode" = start ]; then
  git rev-parse HEAD > "$base_file" 2>/dev/null || true
  find "$(git rev-parse --git-dir)" -maxdepth 1 -name 'claude-trials-base-*' -mtime +14 -delete 2>/dev/null || true
  exit 0
fi

[ "$(field stop_hook_active)" = "True" ] && exit 0

base=$(cat "$base_file" 2>/dev/null || git rev-parse HEAD 2>/dev/null)
paths=$( { git diff --name-only "$base" 2>/dev/null
           git diff --name-only "$base" HEAD 2>/dev/null
           git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
[ -n "$paths" ] || exit 0

# 試行とみなす場所(実装・実験レポート)。生成物と lock ファイルは除く
work=$(printf '%s\n' "$paths" \
  | grep -E '^(fastapi|nextjs/frontend)/|^docs/reports/' \
  | grep -vE '^nextjs/frontend/gen/|package-lock\.json|^fastapi/openapi\.json$|^docs/reports/(README|0000-template)\.md$' || true)
trials=$(printf '%s\n' "$paths" | grep -E '^docs/trials/[0-9]{4}-' || true)

[ -n "$work" ] || exit 0
[ -z "$trials" ] || exit 0

count=$(printf '%s\n' "$work" | sed '/^$/d' | wc -l | tr -d ' ')
sample=$(printf '%s\n' "$work" | sed '/^$/d' | head -5 | sed 's/^/  - /')
python3 - "$count" "$sample" <<'PY'
import json, sys
count, sample = sys.argv[1], sys.argv[2]
print(json.dumps({"decision": "block", "reason":
    f"試行の記録が未更新です。このセッションで実装・実験レポートのファイル {count} 件が変わりましたが、docs/trials/ の問いのファイルは変わっていません。\n"
    f"{sample}\n"
    "まず docs/trials/README.md と grep で既存の問いを探し、内容が被るならそのファイルの試行表に1行足してください(新しいファイルは作らない)。どの問いとも重ならないときだけテンプレートから新設します。"
    "失敗・戻した試行も書き、README の回数と状態も直します(.claude/rules/activity-record.md)。"
    "問いを持たない作業(誤字・整形・依存の機械的な更新など)だけなら、記録しない理由を一言述べて終えてください。"},
    ensure_ascii=False))
PY
exit 0
