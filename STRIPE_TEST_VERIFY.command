#!/bin/bash
set -e
cd "$(dirname "$0")"
node scripts/verify-stripe-test.mjs
