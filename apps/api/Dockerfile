# syntax=docker/dockerfile:1
#
# API image — Fastify + Prisma. Build context is the MONOREPO ROOT
# (it needs pnpm-workspace.yaml, the lockfile, and packages/shared).
#
# We run with `tsx` instead of `node dist/server.js` on purpose: the workspace
# package @repo/shared exports raw TypeScript (src/index.ts, no build step), so
# a plain `tsc` + `node dist` run cannot resolve it at runtime. `tsx` transpiles
# the TS on the fly (same as the dev script) and keeps dev/prod parity.

FROM node:22-slim AS base
# Prisma needs OpenSSL at build (engine download) and runtime.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# --- Install deps (cached on manifest changes) ------------------------------
# Copy every workspace manifest so the frozen lockfile resolves cleanly.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile

# --- App source -------------------------------------------------------------
COPY apps/api ./apps/api
COPY packages ./packages

# Generate the Prisma client (output: apps/api/src/generated/prisma-client).
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Sync additive Prisma schema changes before boot. Without --accept-data-loss,
# Prisma refuses destructive changes instead of applying them implicitly.
CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate && pnpm exec tsx src/server.ts"]
