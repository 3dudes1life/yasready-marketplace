#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm install; fi
npm run build
npm run db:migrate:local
echo "Starting local Worker + D1 + static assets..."
npx wrangler dev --local --port 8788
