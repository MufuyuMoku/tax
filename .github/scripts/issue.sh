#!/usr/bin/env bash
# Open, or comment on, the GitHub issue for something the automatic update needs a person for
# (M9, K-091). GitHub e-mails new issues and comments to the owner. One open issue per title, so a
# problem that lasts several days does not open one issue a day.
set -euo pipefail
title=$(python -c "import json;print(json.load(open('otomatis-hasil.json'))['judul'])")
if [ "${UJI:-tidak}" != "tidak" ]; then title="[UJI] $title"; fi
body=otomatis-laporan.md
printf '\n---\nRun: %s/%s/actions/runs/%s\n' "$GITHUB_SERVER_URL" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" >> "$body"
gh label create pembaruan-otomatis --color D93F0B --description "Pembaruan otomatis butuh manusia" --force >/dev/null
existing=$(gh issue list --state open --label pembaruan-otomatis --limit 50 --json number,title \
  --jq ".[] | select(.title == \"$title\") | .number" | head -1)
if [ -n "$existing" ]; then
  gh issue comment "$existing" --body-file "$body"
  echo "issue #$existing diberi komentar: $title"
else
  gh issue create --title "$title" --label pembaruan-otomatis --body-file "$body"
fi
