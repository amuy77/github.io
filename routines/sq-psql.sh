#!/bin/bash
# LaRa AI 裏方の SQL ヘルパー（裏方専用ロール lara_worker で psql から実行する版）。
#   使い方: bash routines/sq-psql.sh /path/to/query.sql   → 結果は JSON の行配列（select のとき）
# 接続文字列は環境変数 LARA_WORKER_DB_URL（値は表示しない）。docs/worker-role.md の手順で作る。
# select で始まるファイルは json_agg で包むので、今までの手順書の SQL をそのまま使える。
set -euo pipefail
f="$1"
if [ -z "${LARA_WORKER_DB_URL:-}" ]; then echo "LARA_WORKER_DB_URL が未設定" >&2; exit 2; fi
sql=$(sed -e 's/--.*$//' "$f" | tr '\n' ' ' | sed -e 's/[[:space:]]*;[[:space:]]*$//')
if echo "$sql" | grep -qiE '^[[:space:]]*(select|with)[[:space:]]'; then
  printf 'select coalesce(json_agg(t), '"'"'[]'"'"'::json) from (%s) t;' "$sql" | psql "$LARA_WORKER_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1
else
  psql "$LARA_WORKER_DB_URL" -X -q -A -t -v ON_ERROR_STOP=1 -f "$f"
fi
