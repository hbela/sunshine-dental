Done — Postgres now lives inside the compose stack. Here's the change to docker-compose.yml (YAML validated):

db service — postgres:17-alpine, named volume db-data, pg_isready healthcheck, no public port. The api reaches it as db:5432 on the stack's private network — this is what makes the internal URL "just work": services in one compose file share a network automatically, so there's nothing to toggle in Coolify anymore.
api — DATABASE_URL is now composed as postgres://postgres:${POSTGRES_PASSWORD}@db:5432/sunshine and it waits for the db healthcheck (depends_on: condition: service_healthy), so prisma db push can't race a starting Postgres.
backup service — today's nightly-backup image joined the stack too, so it also reaches db internally (this was the hidden problem with standalone DBs: the backup container couldn't have reached them either). disaster-recovery.md updated: the Scheduled Task now targets container backup inside this resource.
Since both prod and dev (sunshinedev) deploy this same file as separate Coolify resources, each stack automatically gets its own isolated Postgres — your standalone postgresql-database-* resources become unnecessary; delete them once the stacks are green, and the public port 5432 goes away with them.
Deployment order matters — set env vars before I push, otherwise the db container fails instantly (the postgres image refuses to start without POSTGRES_PASSWORD):

On both Coolify resources (prod + dev): add POSTGRES_PASSWORD (fresh openssl rand -hex 32 each, different per stack) and remove the old DATABASE_URL variable (it's no longer referenced).
New key ceremony (fresh start, per the runbook — on your machine, don't paste these here): a new master key per environment (openssl rand -hex 32), a new age recovery keypair (age-keygen), escrow the prod master key with it, and put the new age1… public key in the prod stack's BACKUP_AGE_PUBKEY.
Tell me "push" and I'll commit + push to main → both stacks redeploy. Expected health right after: db: ok, encryption: locked, keyFingerprint: null (empty DB, no canary yet).
Seed each stack (this also creates the first admin login and establishes the canary bound to your new key): Coolify → api container terminal → SEED_PASSWORD=<fresh per stack, openssl rand -base64 18> ENCRYPTION_KEY=<that stack's new master key> pnpm exec tsx prisma/seed.ts. The seed refuses a non-local database without SEED_PASSWORD, so no stack can end up with the repo's well-known dev passwords.
Log in as admin@sunshine.dental / <that stack's SEED_PASSWORD>, unlock via the banner with the new master key → health shows unlocked + the new keyFingerprint.
One dev-convenience note: the compose file sets NODE_ENV=production, so crypto.ts refuses env-var unlock by design — on the dev stack you can add ALLOW_ENV_KEY=true + ENCRYPTION_KEY if you'd rather sunshinedev unlock itself on boot; never set those on prod.

The compose + doc changes are ready to commit. Set the env vars and say push.

