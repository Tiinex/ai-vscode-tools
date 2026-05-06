#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="$ROOT_DIR/dist/tools/cli.js"

if [ ! -f "$CLI" ]; then
  echo "dist CLI not found. Build first: npm run build"
  exit 1
fi

if [ $# -eq 0 ]; then
  echo "Usage: $0 <sessionId?> [anchorText]"
  echo "Examples:"
  echo "  $0                # lista sessions (5)"
  echo "  $0 5895583f       # visa index för session"
  echo "  $0 5895583f 'AA-VERIFY' # sök anchor"
  node "$CLI" list --limit 5
  exit 0
fi

SESSION="$1"
ANCHOR="${2:-}"

if [ -z "$ANCHOR" ]; then
  echo "Running session index for $SESSION"
  node "$CLI" index --session-id "$SESSION"
else
  echo "Searching for anchor '$ANCHOR' in session $SESSION"
  node "$CLI" window --session-id "$SESSION" --anchor-text "$ANCHOR" --max-matches 1
fi
