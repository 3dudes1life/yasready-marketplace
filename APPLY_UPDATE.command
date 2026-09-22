#!/bin/bash
set -euo pipefail

PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
PAYLOAD="$PATCH_DIR/payload"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  for candidate in \
    "$HOME/Downloads/yasready-marketplace" \
    "$HOME/Desktop/yasready-marketplace" \
    "$HOME/Documents/yasready-marketplace"; do
    if [[ -f "$candidate/package.json" ]]; then
      TARGET="$candidate"
      break
    fi
  done
fi

if [[ -z "$TARGET" || ! -f "$TARGET/package.json" ]]; then
  echo "Could not find the yasready-marketplace repo."
  echo "Run this command from Terminal with the repo path, for example:"
  echo "  bash \"$0\" \"$HOME/Downloads/yasready-marketplace\""
  exit 1
fi

CURRENT_VERSION="$(node -e 'const p=require(process.argv[1]); process.stdout.write(String(p.version||""))' "$TARGET/package.json" 2>/dev/null || true)"
if [[ "$CURRENT_VERSION" != "0.11.0" ]]; then
  echo "REFUSING TO APPLY: expected Marketplace v0.11.0, found v${CURRENT_VERSION:-unknown}."
  echo "This patch is specifically v0.11.0 -> v0.12.0."
  exit 1
fi

echo "Applying YasReady Marketplace v0.12.0 patch..."
rsync -a "$PAYLOAD/" "$TARGET/"

NEW_VERSION="$(node -e 'const p=require(process.argv[1]); process.stdout.write(String(p.version||""))' "$TARGET/package.json" 2>/dev/null || true)"
if [[ "$NEW_VERSION" != "0.12.0" ]]; then
  echo "Patch copy completed, but version verification failed (found v${NEW_VERSION:-unknown})."
  exit 1
fi

echo "PASS: Marketplace updated to v0.12.0"
echo "Changed/new repo files applied: $(find "$PAYLOAD" -type f | wc -l | tr -d ' ')"
echo "No repo files are deleted by this patch."
