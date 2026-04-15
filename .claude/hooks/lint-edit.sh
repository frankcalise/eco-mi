#!/usr/bin/env bash
# Claude Code PostToolUse hook: lint the file just edited.
#
# Reads the tool input JSON from stdin, extracts file_path, and runs
# eslint on the single file if it's a JS/TS source. On failure, prints
# stderr and exits 2 so Claude sees the errors as a system reminder and
# can fix them in the same session (scoped, immediate feedback).
#
# Skips the lint entirely for non-source files (json, md, yaml, etc.).
set -u

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$PWD}"

# --cache keeps repeat runs fast during long sessions.
if ! output=$(npx --no-install eslint "$FILE" --cache 2>&1); then
  printf '%s\n' "$output" >&2
  exit 2
fi

exit 0
