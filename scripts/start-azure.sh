#!/bin/sh
set -eu
# Ubuntu Azure Web App startup command: sh scripts/start-azure.sh
cd -- "$(dirname -- "$0")/.."
export NODE_ENV=production
# /home survives restarts on Linux App Service. Keep browser downloads outside wwwroot.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/home/playwright}"

# Ensure Ubuntu's system trust store is available before installing Playwright.
if ! command -v update-ca-certificates >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends ca-certificates
fi

# Configure container certificates before installing Playwright or launching Node
if [ -d "certs" ]; then
  if [ -f "certs/ca-certificates.crt" ]; then
    export NODE_EXTRA_CA_CERTS="${PWD}/certs/ca-certificates.crt"
    export SSL_CERT_FILE="${PWD}/certs/ca-certificates.crt"
  fi

  # If running with root permissions, update system trust store as well
  if command -v update-ca-certificates >/dev/null 2>&1 && [ -w /usr/local/share/ca-certificates ]; then
    if [ -d "certs/extra" ] && [ "$(ls -A certs/extra 2>/dev/null)" ]; then
      cp certs/extra/* /usr/local/share/ca-certificates/ 2>/dev/null || true
    fi
    update-ca-certificates 2>/dev/null || true
  fi
fi

# Playwright installs Chromium and its Ubuntu system dependencies.
node node_modules/playwright/cli.js install --with-deps chromium
exec node dist/index.js
