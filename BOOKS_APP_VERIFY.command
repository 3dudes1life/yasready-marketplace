#!/bin/bash
set -e
cd "$(dirname "$0")"
node scripts/verify-books-app.mjs
