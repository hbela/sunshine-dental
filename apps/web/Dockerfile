# syntax=docker/dockerfile:1
#
# Web image — Vite SPA built to static files, served by nginx.
# Build context is the MONOREPO ROOT (needs the lockfile + packages/shared).
#
# VITE_API_URL is intentionally left empty: the SPA talks to the API same-origin
# via /api, which nginx reverse-proxies to the `api` service (see nginx.conf).
# This keeps the better-auth session cookie first-party and avoids CORS.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages ./packages

WORKDIR /app/apps/web
RUN pnpm build

# --- Serve ------------------------------------------------------------------
FROM nginx:1.27-alpine AS run
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
