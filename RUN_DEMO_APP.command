#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm install; fi
PORT=4173
URL="http://127.0.0.1:${PORT}"
(sleep 1.5; open "$URL") &
npm run dev -- --host 127.0.0.1 --port "$PORT"
