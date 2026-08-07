#!/usr/bin/env bash
# Brings the collector up on a fresh Debian/Ubuntu VM. Idempotent: safe to
# re-run after shipping new code.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> checking prerequisites"
if ! command -v docker >/dev/null 2>&1; then
  echo "==> installing Docker"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: the Docker Compose plugin is missing." >&2
  exit 1
fi

# Restart Docker itself on boot, so a VM reboot brings the collector back
# without anyone logging in.
systemctl enable docker >/dev/null 2>&1 || true

if [ ! -f "$HERE/../operator.env" ]; then
  echo "ERROR: operator.env is missing. Ship it from the workstation." >&2
  exit 1
fi

if [ ! -f "$HERE/../vendor/proto/request_login.proto" ]; then
  echo "ERROR: the licensed Rithmic proto files are missing." >&2
  exit 1
fi

echo "==> building and starting (image stays local; never pushed to a registry)"
cd "$HERE"
docker compose up -d --build

echo "==> waiting for the Rithmic session"
for _ in $(seq 1 30); do
  sleep 5
  if curl -fsS --max-time 5 http://127.0.0.1:8793/health 2>/dev/null \
     | grep -q '"authenticated":true'; then
    echo "==> authenticated"
    break
  fi
done

echo
echo "==> container status"
docker compose ps
echo
echo "==> health"
curl -s --max-time 10 http://127.0.0.1:8793/health || true
echo
echo
echo "A live feed means connected:true AND lastMessageAt advancing between"
echo "calls. connected:true with a frozen lastMessageAt is a dead feed wearing"
echo "a live label - treat it as an outage."
