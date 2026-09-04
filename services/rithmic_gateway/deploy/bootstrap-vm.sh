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

# Vultr (and several other) Ubuntu images ship with ufw active, only port 22
# open, and DEFAULT_FORWARD_POLICY=DROP. The dropped FORWARD chain silently
# kills container-to-container traffic on the Docker bridge: Caddy accepts the
# TLS connection, then hangs forever trying to reach the gateway. It presents
# as "the site loads but never responds", which is a miserable thing to debug.
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "==> opening 80/443 and allowing forwarding for Docker"
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  if grep -q '^DEFAULT_FORWARD_POLICY="DROP"' /etc/default/ufw 2>/dev/null; then
    sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
  fi
  ufw reload >/dev/null 2>&1 || true
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

# QuantData owns the licensed options and cash-index surfaces in production.
# Refuse before touching the running container if a workstation upload and a
# failed credential restore have left the VPS environment without its key.
# This exact omission caused GEX, SPX and NDX to be dead at the opening bell
# while the gateway itself still appeared deployable.
if ! grep -Eq '^QUANTDATA_API_KEY=.+$' "$HERE/../operator.env"; then
  echo "ERROR: QUANTDATA_API_KEY is missing; refusing to replace the live gateway." >&2
  exit 1
fi

# Raw Rithmic/L3 history is irreplaceable.  Never let Compose fall back to a
# normal directory on the small root disk when the dedicated recording disk
# is detached or failed to mount.
RECORDINGS_HOST_DIR=/srv/kwantdesk-recordings
if ! mountpoint -q "$RECORDINGS_HOST_DIR"; then
  echo "ERROR: $RECORDINGS_HOST_DIR is not a mounted filesystem; refusing to start the recorder on the VM root disk." >&2
  exit 1
fi
if [ ! -w "$RECORDINGS_HOST_DIR" ]; then
  echo "ERROR: $RECORDINGS_HOST_DIR is not writable; refusing to start the recorder." >&2
  exit 1
fi

# Docker's restart policy must not race the block-device mount after a reboot.
# Requiring the mount at the service boundary fails closed instead of letting
# the gateway recreate /srv/kwantdesk-recordings on the small root disk.
install -d -m 0755 /etc/systemd/system/docker.service.d
install -m 0644 \
  "$HERE/docker.service.d/kwantdesk-recordings.conf" \
  /etc/systemd/system/docker.service.d/kwantdesk-recordings.conf
systemctl daemon-reload

echo "==> building and starting (image stays local; never pushed to a registry)"
cd "$HERE"
docker compose up -d --build

# The History Plant importer is separate from the latency-sensitive live
# gateway. Its persistent ledger makes every seven-day window idempotent, and
# this boot unit resumes the queue after host maintenance only after the
# dedicated recordings filesystem and Docker are both available.
install -m 0644 \
  "$HERE/kwantdesk-history-backfill.service" \
  /etc/systemd/system/kwantdesk-history-backfill.service
install -m 0644 \
  "$HERE/kwantdesk-cash-history-backfill.service" \
  /etc/systemd/system/kwantdesk-cash-history-backfill.service
systemctl daemon-reload
systemctl enable kwantdesk-history-backfill.service
systemctl enable kwantdesk-cash-history-backfill.service
# Start asynchronously: the unit deliberately waits five minutes so the live
# gateway's tiny post-close catch-up and the bulk backfill never race each
# other for the same QuantData quota or archive files.
systemctl restart --no-block kwantdesk-cash-history-backfill.service

echo "==> waiting for the Rithmic session"
for _ in $(seq 1 30); do
  sleep 5
  if docker compose exec -T gateway node -e \
       "fetch('http://127.0.0.1:8793/health').then(async response => { if (!response.ok) process.exit(1); process.stdout.write(await response.text()); }).catch(() => process.exit(1))" \
       2>/dev/null \
     | grep -Eq '"authenticated"[[:space:]]*:[[:space:]]*true'; then
    echo "==> authenticated"
    break
  fi
done

echo
echo "==> container status"
docker compose ps
echo
echo "==> health"
docker compose exec -T gateway node -e \
  "fetch('http://127.0.0.1:8793/health').then(async response => process.stdout.write(await response.text())).catch(error => { console.error(error.message); process.exit(1); })" \
  || true
echo
echo
echo "A live feed means connected:true AND lastMessageAt advancing between"
echo "calls. connected:true with a frozen lastMessageAt is a dead feed wearing"
echo "a live label - treat it as an outage."
