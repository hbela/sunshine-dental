# Dev/Prod split for the Retell voice agent (agents, data, and promotion workflow)

## Context

n8n was split into **n8ndev** and **n8nprod**, but the layers around it were not, so "dev" isn't a real environment yet:

- **One Retell agent** (`agent_0c73886e96f6cf2ad878def30e` + LLM `llm_9144fb5e818b3d841e18ab084b99`) is shared and keeps getting flip-flopped. Right now it's in a **mixed state**: custom-tool URLs → **n8nprod**, but the agent's post-call `webhook_url` → **n8ndev** (verified live). So production call logging + confirmation emails currently land in dev.
- **No data isolation.** The dev n8n router's HTTP nodes point at the **prod** API (`sunshine.appointer.hu`), and the documented "n8ndev → ngrok → local Postgres" path was retired at go-live. Any dev booking test writes to the **real** calendar/DB.
- Retell **custom-tool URLs live on the LLM, not the agent** — so a single agent/LLM physically cannot serve prod (n8nprod) and be tested against dev (n8ndev) at the same time.

**Goal:** a genuinely isolated dev lane end-to-end (Retell → n8n → API → DB) and a repeatable dev→prod promotion workflow, with the existing agent/LLM/API/DB becoming **prod**.

### Target architecture
```
DEV   Retell DEV agent + DEV LLM  → n8ndev.appointer.hu  → api-dev (sunshinedev.appointer.hu) → DEV Postgres
PROD  Retell PROD agent + PROD LLM → n8nprod.appointer.hu → sunshine.appointer.hu/api          → PROD Postgres
      (existing agent_0c73… / llm_9144… = PROD; DEV is a new clone)
```

---

## Part 1 — Dev backend (API + DB)  *(enables real isolation)*

Stand up a second API + database so dev traffic never touches prod data. Reuse the existing app unchanged — only env differs.

- **Coolify:** add a second service from the same repo/branch, domain **`sunshinedev.appointer.hu`**, reusing [apps/api/Dockerfile](apps/api/Dockerfile) and [docker-compose.yml](docker-compose.yml). Env per [apps/api/.env.example](apps/api/.env.example): a **separate `DATABASE_URL`** (new Prisma Postgres DB or a Coolify Postgres container), a **distinct `FASTIFY_API_KEY`**, and `WEB_ORIGIN`/`BETTER_AUTH_*` set to the dev host.
- **Schema + seed:** `prisma db push` then reuse [apps/api/prisma/seed.ts](apps/api/prisma/seed.ts) against the dev DB (real providers Dr. Ibolya Nagy / Dr. István).
- **Health:** the new public [apps/api/src/routes/health.routes.ts](apps/api/src/routes/health.routes.ts) `GET /api/health` gives dev its own probe; add it to the uptime monitor.
- The dev **web SPA is optional** (handy for eyeballing dev bookings); the voice flow only needs the dev API.
- Document in [docs/deploy.md](docs/deploy.md).

## Part 2 — Retell DEV clone (agent + LLM)

Clone the prod pair; keep the existing pair as prod.

- Add **`workflows/scripts/retell-clone-env.mjs`** (SDK `llm.create` + `agent.create`, mirroring the SDK usage in [retell-set-webhooks.mjs](workflows/scripts/retell-set-webhooks.mjs)): copy prod LLM → **DEV LLM** with tool URLs → `n8ndev/webhook/retell-custom-functions`; copy the agent → **DEV agent** with `webhook_url` → `n8ndev/webhook/retell-post-call` and `response_engine.llm_id` = DEV LLM. Same voice/languages. (There is no clone script today — all scripts mutate the one agent by ID.)
- Record the new `agent_id`/`llm_id` in the env map (Part 3).
- **Immediate fix:** repoint the **prod** agent's post-call `webhook_url` back to **n8nprod** and re-publish (undo the current mixed state).

## Part 3 — Env-parametrize the Retell scripts

- Add **`workflows/scripts/retell-env.mjs`** exporting an env map:
  ```
  { dev:  { AGENT_ID: <dev>,  LLM_ID: <dev>,  BASE: 'https://n8ndev.appointer.hu' },
    prod: { AGENT_ID: 'agent_0c73…', LLM_ID: 'llm_9144…', BASE: 'https://n8nprod.appointer.hu' } }
  ```
- Refactor [retell-set-webhooks.mjs](workflows/scripts/retell-set-webhooks.mjs), [retell-set-voice.mjs](workflows/scripts/retell-set-voice.mjs), [retell-add-language.mjs](workflows/scripts/retell-add-language.mjs) to take **`--env dev|prod`** (default `prod`) and read IDs/BASE from `retell-env.mjs`, replacing the hardcoded `AGENT_ID`/`LLM_ID`/`DEFAULT_BASE`. Keep `--base`/`--dry-run`. Preserve the existing `RETELL_API_KEY` resolution (env → `.mcp.json`).
- Update `package.json` script docs to show `pnpm retell:set-webhooks -- --env dev`.

## Part 4 — n8n dev/prod parity (where isolation actually lands)

- **n8ndev** router + post-call HTTP nodes → point at **`https://sunshinedev.appointer.hu/api`** with the **dev** `FASTIFY_API_KEY` (replacing the current `sunshine.appointer.hu`). Edit via the dev MCP server `mcp__n8n__` (bound to n8ndev); prod stays on `mcp__n8n-mcp__`.
- **"Update LLM Date Daily" cron:** prod copy active → **prod** LLM; dev copy targets the **dev** LLM and stays deactivated unless testing (so the date isn't PATCHed twice, and dev never PATCHes the prod LLM).
- Carry over the recent error-handling fix + error-alert wiring already applied to prod so dev matches.

## Part 5 — Promotion workflow (dev → prod)

Document in **new `docs/dev-prod-promotion.md`** (and trim the now-outdated dev model in [workflows/CLAUDE.md](workflows/CLAUDE.md) / [docs/n8n-dev-prod-split-plan.md](docs/n8n-dev-prod-split-plan.md)):

1. **Develop** against dev: edit repo source-of-truth (prompt in `docs/retell-agent-prompt.md`, tools in `docs/retell-custom-functions.md`) and n8ndev workflows.
2. **Apply to dev:** `retell:set-webhooks/set-voice/add-language -- --env dev`; save the dev agent.
3. **Test on dev:** web calls + Retell simulation → verify n8ndev executions, rows in the **dev** DB, and `sunshinedev…/api/health`. No prod impact.
4. **Promote:**
   - **n8n:** copy dev workflows → n8nprod (export/import JSON, or `n8n_update_full_workflow` dev→prod), swapping API base+key dev→prod; keep node structure identical.
   - **Retell:** re-run the same scripts with `-- --env prod`, then **publish** the prod agent — Retell's native publish is the promotion gate (published versions pin webhook/tool config).
5. **Verify prod:** smoke web call → n8nprod execution → prod DB row → post-call email → error-alert stays quiet.
6. **Rollback:** revert to the previous **published** Retell version; use n8n workflow version history.

## Out of scope / fold-in
- Rotate the `FASTIFY_API_KEY` and Retell API key that were exposed earlier (do this as part of introducing the new dev/prod keys).
- Phone number: none provisioned yet; when added, bind it to the **prod** agent only.

## Critical files
- **Reuse:** [apps/api/Dockerfile](apps/api/Dockerfile), [docker-compose.yml](docker-compose.yml), [apps/api/prisma/seed.ts](apps/api/prisma/seed.ts), [apps/api/.env.example](apps/api/.env.example), [apps/api/src/routes/health.routes.ts](apps/api/src/routes/health.routes.ts).
- **Parametrize:** the three `workflows/scripts/retell-*.mjs` above.
- **New:** `workflows/scripts/retell-env.mjs`, `workflows/scripts/retell-clone-env.mjs`, `docs/dev-prod-promotion.md`.
- **Edit (live, via MCP):** n8ndev workflows (dev API base); no repo change for those.
- **Update docs:** [workflows/CLAUDE.md](workflows/CLAUDE.md), [docs/n8n-dev-prod-split-plan.md](docs/n8n-dev-prod-split-plan.md), [docs/deploy.md](docs/deploy.md).

## Verification
1. **Dev backend:** `curl https://sunshinedev.appointer.hu/api/health` → `200`; dev DB seeded.
2. **Two agents:** `retell_list_agents` shows distinct dev/prod agents with different `llm_id`s; grep confirms dev LLM tools → n8ndev, prod → n8nprod.
3. **Isolation:** a booking via the **dev** agent appears in the **dev** DB only; prod calendar unchanged.
4. **Scripts:** `-- --env dev --dry-run` and `-- --env prod --dry-run` report correct targets and no unintended drift.
5. **Promotion dry-run:** walk the checklist end-to-end on a trivial prompt tweak; confirm prod only changes after the explicit `--env prod` + publish step.
