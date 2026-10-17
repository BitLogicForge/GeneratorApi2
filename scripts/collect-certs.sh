#!/usr/bin/env bash
set -euo pipefail

# Collects system and local CA certificates from the container into target directory (default: certs).
TARGET_DIR="${1:-certs}"

mkdir -p "${TARGET_DIR}/extra"

if [ -f /etc/ssl/certs/ca-certificates.crt ]; then
  cp /etc/ssl/certs/ca-certificates.crt "${TARGET_DIR}/ca-certificates.crt"
fi

if [ -d /usr/local/share/ca-certificates ]; then
  cp -L -r /usr/local/share/ca-certificates/* "${TARGET_DIR}/extra/" 2>/dev/null || true
fi

find /etc/ssl/certs -maxdepth 1 -type f \( -name "*.crt" -o -name "*.pem" \) ! -name "ca-certificates.crt" -exec cp {} "${TARGET_DIR}/extra/" \; 2>/dev/null || true

# Remove extra directory if no extra certificates were found
rmdir "${TARGET_DIR}/extra" 2>/dev/null || true
