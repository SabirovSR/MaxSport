#!/usr/bin/env bash
# Send CI/CD status to Telegram (KennyWeb-style message).
# Required env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (optional - skip if empty)
# Context env: STATUS, TITLE, RUN_URL, SHA, REF, COMMIT_SUBJECT, COMMIT_BODY,
#              COMPARE_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_TOKEN,
#              SERVER_URL
# Optional: FAILED_JOBS (comma-separated names for log fetch)

set -euo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "WARN: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID empty - skip notify"
  exit 0
fi

html_escape() {
  local s=${1:-}
  s=${s//&/\&amp;}
  s=${s//</\&lt;}
  s=${s//>/\&gt;}
  printf '%s' "$s"
}

trim() {
  local s
  s=$(printf '%s' "${1:-}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  printf '%s' "$s"
}

format_title() {
  local t
  t=$(html_escape "${1:-}")
  t=${t// · prod/ · <code>prod<\/code>}
  printf '%s' "$t"
}

branch_path_from_ref() {
  local ref=${1:-}
  case "$ref" in
    refs/heads/*) printf '%s' "${ref#refs/heads/}" ;;
    refs/tags/*) printf 'tags/%s' "${ref#refs/tags/}" ;;
    *) printf '%s' "$ref" ;;
  esac
}

fetch_log_snippet() {
  local repo=$1 run_id=$2 job_hint=$3
  local jobs_json job_id log_raw snippet

  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    echo ""
    return 0
  fi

  jobs_json=$(curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/actions/runs/${run_id}/jobs?per_page=50" \
    2>/dev/null || true)

  if [[ -z "$jobs_json" ]]; then
    echo ""
    return 0
  fi

  job_id=$(python3 -c "
import json, sys
data = json.loads(sys.argv[1])
hint = sys.argv[2].strip().lower()
failed = [j for j in data.get('jobs', []) if j.get('conclusion') == 'failure']
if not failed:
    sys.exit(0)
if hint:
    for j in failed:
        if j.get('name', '').lower() == hint or hint in j.get('name', '').lower():
            print(j['id'])
            sys.exit(0)
print(failed[0]['id'])
" "$jobs_json" "${job_hint:-}" 2>/dev/null || true)

  if [[ -z "$job_id" ]]; then
    echo ""
    return 0
  fi

  log_raw=$(curl -fsSL \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/actions/jobs/${job_id}/logs" \
    2>/dev/null || true)

  if [[ -z "$log_raw" ]]; then
    echo ""
    return 0
  fi

  snippet=$(printf '%s\n' "$log_raw" \
    | sed -E 's/\x1b\[[0-9;]*[a-zA-Z]//g' \
    | grep -vE '^##\[(group|endgroup|command|debug|notice)\]' \
    | grep -vE '^\*{3,} ' \
    | grep -vE '^[[:space:]]*$' \
    | tail -n 40 \
    | tail -n 20 \
    || true)

  printf '%s' "$snippet" | head -c 1800
}

STATUS=${STATUS:-failure}
TITLE=${TITLE:-MAX Sport: status unknown}
RUN_URL=${RUN_URL:-}
SHA=${SHA:-}
REF=${REF:-}
COMMIT_SUBJECT=$(trim "${COMMIT_SUBJECT:-}")
COMMIT_BODY=$(trim "${COMMIT_BODY:-}")
COMPARE_URL=${COMPARE_URL:-}
FAILED_JOBS=${FAILED_JOBS:-}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-}
GITHUB_RUN_ID=${GITHUB_RUN_ID:-}
SERVER_URL=${SERVER_URL:-https://github.com}

REPO_BASE="${SERVER_URL}/${GITHUB_REPOSITORY}"

{
  printf '%s\n\n' "$(format_title "$TITLE")"

  if [[ -n "$RUN_URL" ]]; then
    printf '<a href="%s">Открыть запуск workflow</a>\n\n' "$(html_escape "$RUN_URL")"
  fi

  if [[ -n "$COMMIT_SUBJECT" ]]; then
    printf '%s\n' "$(html_escape "$COMMIT_SUBJECT")"
    if [[ -n "$COMMIT_BODY" ]]; then
      BODY_LINE=$(printf '%s\n' "$COMMIT_BODY" | sed '/./,$!d' | head -n 1)
      BODY_LINE=$(trim "$BODY_LINE")
      if [[ -n "$BODY_LINE" ]]; then
        printf '%s\n' "$(html_escape "$BODY_LINE")"
      fi
    fi
  fi

  if [[ -n "$COMPARE_URL" ]]; then
    printf '<a href="%s">Изменения на GitHub</a>\n' "$(html_escape "$COMPARE_URL")"
  fi

  printf '\n'
  if [[ -n "$REF" ]]; then
    BRANCH_PATH=$(branch_path_from_ref "$REF")
    TREE_URL="${REPO_BASE}/tree/${BRANCH_PATH}"
    printf 'Ref <a href="%s"><code>%s</code></a>\n' \
      "$(html_escape "$TREE_URL")" \
      "$(html_escape "$REF")"
  fi
  if [[ -n "$SHA" ]]; then
    COMMIT_URL="${REPO_BASE}/commit/${SHA}"
    printf 'SHA <a href="%s"><code>%s</code></a>\n' \
      "$(html_escape "$COMMIT_URL")" \
      "$(html_escape "$SHA")"
  fi

  if [[ "$STATUS" == "failure" ]]; then
    printf '\n<b>Что упало</b>\n'
    if [[ -n "$FAILED_JOBS" ]]; then
      printf '%s\n' "$(html_escape "$FAILED_JOBS")"
    fi
    FIRST_JOB=${FAILED_JOBS%%,*}
    SNIPPET=$(fetch_log_snippet "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" "$FIRST_JOB")
    if [[ -n "$SNIPPET" ]]; then
      printf '\n<pre>%s</pre>\n' "$(html_escape "$SNIPPET")"
    elif [[ -n "$RUN_URL" ]]; then
      printf 'Смотри логи в запуске workflow.\n'
    fi
  fi
} > /tmp/telegram-message.txt

MSG=$(head -c 4000 /tmp/telegram-message.txt)

HTTP_CODE=$(curl -sS -o /tmp/telegram-response.txt -w '%{http_code}' \
  -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MSG}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "disable_web_page_preview=true")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Telegram API HTTP ${HTTP_CODE}"
  cat /tmp/telegram-response.txt || true
  exit 1
fi

echo "Telegram notify sent (status=${STATUS})"
