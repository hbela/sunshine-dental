# syntax=docker/dockerfile:1
#
# Backup service image — see docs/disaster-recovery.md ("Automated backups").
# Build context is the MONOREPO ROOT (same convention as apps/*/Dockerfile);
# in Coolify set "Dockerfile Location" to /scripts/backup.Dockerfile.
#
# The container idles; a Coolify Scheduled Task (0 3 * * *) execs
# `backup-db.sh` inside it so every run is visible in the Coolify UI.
#
# postgresql17-client matches the current servers (Prisma.io 17.2, VPS 17.10).
# If a server is ever upgraded past 17, bump the client here first — pg_dump
# must be >= the server's major version (see the triage table in the runbook).
FROM alpine:3.22

RUN apk add --no-cache bash curl age rclone postgresql17-client tzdata

COPY scripts/backup-db.sh /usr/local/bin/backup-db.sh
RUN chmod +x /usr/local/bin/backup-db.sh

# No server process — stay alive for the scheduled task to exec into.
CMD ["tail", "-f", "/dev/null"]
