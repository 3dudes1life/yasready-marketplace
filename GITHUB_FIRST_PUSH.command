#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
REMOTE="https://github.com/3dudes1life/yasready-marketplace.git"

echo "Marketplace | YasReady — first GitHub push helper"
echo "Repo: $REMOTE"
echo ""
if [ -d .git ]; then
  echo "Existing .git directory found. This helper will not overwrite it."
else
  git init
fi

git branch -M main
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git add .
if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit -m "Marketplace | YasReady v0.1.0 foundation"
fi

echo ""
echo "Ready to push. Running: git push -u origin main"
git push -u origin main
