#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
npm run lint
npm run templates:preflight
npm run browser:install
npm test
