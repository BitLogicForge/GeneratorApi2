#!/usr/bin/env bash
set -euo pipefail
# App Service startup command: bash scripts/start-azure.sh
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export NODE_ENV=production
export HOST="${HOST:-0.0.0.0}"
# /home survives restarts on Linux App Service. Keep browser downloads outside wwwroot.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/home/playwright}"

# Azure's PORT is supplied by the platform; do not replace it with a fixed value.
node node_modules/playwright/cli.js install --with-deps chromium
exec node dist/index.js
