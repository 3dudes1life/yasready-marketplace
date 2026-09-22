#!/bin/bash
set -euo pipefail
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  for candidate in \
    "$HOME/Documents/GitHub/yasready-marketplace" \
    "$HOME/GitHub/yasready-marketplace" \
    "$HOME/Downloads/yasready-marketplace" \
    "$PATCH_DIR/../yasready-marketplace"; do
    if [[ -f "$candidate/package.json" ]]; then TARGET="$candidate"; break; fi
  done
fi

if [[ -z "$TARGET" || ! -f "$TARGET/package.json" ]]; then
  echo "Could not find your yasready-marketplace repo."
  echo "Run again with the repo path, for example:"
  echo "  ./APPLY_UPDATE.command \"$HOME/Documents/GitHub/yasready-marketplace\""
  exit 2
fi

CURRENT_VERSION=$(python3 - <<PY
import json
print(json.load(open(r'''$TARGET/package.json'''))['version'])
PY
)
if [[ "$CURRENT_VERSION" != "0.13.0" ]]; then
  echo "Expected v0.13.0 baseline, found v$CURRENT_VERSION in: $TARGET"
  echo "Patch stopped before changing anything."
  exit 3
fi

echo "Applying Marketplace | YasReady v0.14.0 patch"
echo "Baseline: v$CURRENT_VERSION"
echo "Target:   $TARGET"

cd "$PATCH_DIR"
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  mkdir -p "$TARGET/$(dirname "$rel")"
  cp -p "$PATCH_DIR/$rel" "$TARGET/$rel"
done < <(awk '/^(NEW|CHANGED)/{sub(/^(NEW|CHANGED)[[:space:]]+/,""); print}' PATCH_MANIFEST.txt)

echo "Files applied. Running safe verification..."
cd "$TARGET"
node --check src/worker.mjs
node --check src/main.js
node --check src/lib/business-bridge.mjs
npm test
npm run verify:business-bridge
npm run verify:publishing
npm run verify:publishing-live
npm run verify:books
npm run verify:ingram-ops

echo ""
echo "PASS: Marketplace | YasReady is now v0.14.0"
echo "New D1 migration is NOT applied automatically. When ready, run:"
echo "  npm run db:migrate:local    # local"
echo "  npm run db:migrate:remote   # remote, only when intentional"
echo ""
echo "Business service sync remains OFF until you deliberately configure:"
echo "  BUSINESS_BRIDGE_ENABLED=true"
echo "  BUSINESS_BRIDGE_SECRET=<secret>"
