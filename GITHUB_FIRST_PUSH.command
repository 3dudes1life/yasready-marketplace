#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
REMOTE="https://github.com/3dudes1life/yasready-marketplace.git"
if [ ! -d .git ]; then git init; fi
git branch -M main
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REMOTE"; else git remote add origin "$REMOTE"; fi
git add .
if ! git diff --cached --quiet; then git commit -m "Marketplace | YasReady v0.2.0 — Marketplace Engine"; fi
echo "Pushing to $REMOTE"
git push -u origin main
