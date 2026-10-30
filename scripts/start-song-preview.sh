#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1
cd "$(dirname "$0")/../packages/nextjs"
exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port "${PORT:-3001}"
