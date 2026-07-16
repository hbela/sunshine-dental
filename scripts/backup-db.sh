#!/usr/bin/env bash
#
# Nightly encrypted database backup — the job described in
# docs/disaster-recovery.md ("Automated backups").
#
# Dumps the WHOLE database (never selective tables — the encryption.keycheck
# canary and the ciphertext must travel as a matched set), encrypts it with the
# clinic recovery PUBLIC key (the server can create backups it can never read),
# uploads it offsite to a Hetzner Storage Box, prunes old copies, and finally
# pings the dead-man's switch. Any failed step exits non-zero and skips the
# ping, so a missed/failed run makes the healthcheck fire.
#
# Required env:
#   BACKUP_DATABASE_URL   direct (non-pooled) Postgres URL — secret
#   BACKUP_AGE_PUBKEY     clinic recovery public key (age1…) — not secret
# Offsite (strongly recommended — without it a dead VPS takes the backups with it):
#   STORAGEBOX_HOST       e.g. u123456.your-storagebox.de
#   STORAGEBOX_USER       e.g. u123456
#   STORAGEBOX_PASS       Storage Box password — secret
#   STORAGEBOX_DIR        remote directory (default: backups/sunshine)
#   STORAGEBOX_PORT       default: 22
# Optional:
#   HEALTHCHECK_URL       healthchecks.io ping URL (dead-man's switch)
#   BACKUP_DIR            local staging/retention dir (default: /backups)
#   RETENTION_DAYS        prune horizon, local and remote (default: 90)
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required (direct, non-pooled URL)}"
: "${BACKUP_AGE_PUBKEY:?BACKUP_AGE_PUBKEY is required (age1… public key)}"
case "$BACKUP_AGE_PUBKEY" in
  age1*) ;;
  *) echo "FATAL: BACKUP_AGE_PUBKEY does not look like an age public key (age1…)" >&2; exit 1 ;;
esac

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
STAMP="$(date +%F-%H%M)"
FILE="sunshine-${STAMP}.dump.age"

mkdir -p "$BACKUP_DIR"

echo "[backup] dumping database → ${FILE}"
pg_dump -Fc --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | age -r "$BACKUP_AGE_PUBKEY" > "${BACKUP_DIR}/${FILE}"

# pipefail catches pg_dump/age failures; this catches a "successful" empty or
# truncated stream. A real dump of this schema is tens of KB before growth.
SIZE=$(stat -c%s "${BACKUP_DIR}/${FILE}")
if [ "$SIZE" -lt 10240 ]; then
  echo "FATAL: ${FILE} is only ${SIZE} bytes — refusing to treat a stub as a backup" >&2
  exit 1
fi
echo "[backup] wrote ${BACKUP_DIR}/${FILE} (${SIZE} bytes)"

if [ -n "${STORAGEBOX_HOST:-}" ]; then
  : "${STORAGEBOX_USER:?STORAGEBOX_USER is required when STORAGEBOX_HOST is set}"
  : "${STORAGEBOX_PASS:?STORAGEBOX_PASS is required when STORAGEBOX_HOST is set}"
  REMOTE_DIR="${STORAGEBOX_DIR:-backups/sunshine}"
  export RCLONE_SFTP_HOST="$STORAGEBOX_HOST"
  export RCLONE_SFTP_USER="$STORAGEBOX_USER"
  export RCLONE_SFTP_PORT="${STORAGEBOX_PORT:-22}"
  RCLONE_SFTP_PASS="$(rclone obscure "$STORAGEBOX_PASS")"
  export RCLONE_SFTP_PASS

  echo "[backup] uploading to storage box :sftp:${REMOTE_DIR}/${FILE}"
  rclone copyto "${BACKUP_DIR}/${FILE}" ":sftp:${REMOTE_DIR}/${FILE}"

  echo "[backup] pruning remote copies older than ${RETENTION_DAYS} days"
  rclone delete ":sftp:${REMOTE_DIR}" \
    --include "sunshine-*.dump.age" --min-age "${RETENTION_DAYS}d"
else
  echo "[backup] WARNING: STORAGEBOX_HOST not set — backup is LOCAL ONLY and will not survive loss of this VPS" >&2
fi

# Local retention (the volume doubles as a fast restore cache).
find "$BACKUP_DIR" -name 'sunshine-*.dump.age' -mtime +"$RETENTION_DAYS" -delete

if [ -n "${HEALTHCHECK_URL:-}" ]; then
  curl -fsS --retry 3 -o /dev/null "$HEALTHCHECK_URL"
  echo "[backup] healthcheck pinged"
else
  echo "[backup] WARNING: HEALTHCHECK_URL not set — nobody will notice a missed run" >&2
fi

echo "[backup] OK ${FILE}"
