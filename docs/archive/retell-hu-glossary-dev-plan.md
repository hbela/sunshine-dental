# Plan: Port the Hungarian glossary to the Retell voice agent (dev-first)

## Context

The chat receptionist has a curated Hungarian glossary (fogorvos not fogász, tisztítás not takarítás, személyi igazolvány/TAJ kártya, correct appointment-type names). The **voice** agent (Retell) is a version behind: its LLM prompt has **no** Hungarian glossary, and its n8n FAQ told new patients to bring a "biztosítási kártya" — the exact term the chat glossary forbids.

Goal: bring the voice agent's Hungarian up to the chat's quality, and **validate it entirely on dev** (n8ndev + the agent's webhooks pointed at dev + sunshinedev) **without touching prod**.

### Critical constraint
There is **one shared Retell agent + LLM** (`agent_0c73886e96f6cf2ad878def30e` / `llm_9144fb5e818b3d841e18ab084b99`). Editing `general_prompt` is **NOT dev-isolated** — webhook repointing only reroutes tools to n8ndev; the glossary edit lands on the shared LLM. **Dev safety relies on Retell's publish gate:** live prod calls use the last *published* version; unpublished draft edits (prompt + webhook URLs) do not affect them. Rule: **edit the draft, test via an unpublished Test Call, and DO NOT re-publish until deliberately promoting to prod.** The n8ndev FAQ edit is genuinely isolated (separate instance).

## Changes (done in repo / dev)

### 1. Voice-adapted Hungarian glossary in the Retell LLM prompt
`workflows/scripts/retell-add-language.mjs` — added a **B7** block: a `### Hungarian Terminology` section (`HU_GLOSSARY_SECTION`), inserted before the `### Core Responsibilities` anchor (idempotent guard on the heading). Voice-adapted: formal "Ön", spoken, no emoji. Also made **B6** non-fatal (warn+skip) so a drifted emergency line no longer aborts the whole script. Run: `RETELL_API_KEY=… node workflows/scripts/retell-add-language.mjs [--dry-run]` (env-only key; no `.mcp.json` fallback in this script).

### 2. n8ndev FAQ (`new_patient_info` only)
Workflow `rQ7I7vX2oAYnNIbR`, node **FAQ Handler**, HU `new_patient_info`: "biztosítási kártyáját" → "személyi igazolványát, a TAJ-kártyáját". Applied via `n8n_update_partial_workflow` `patchNodeField`. `services` left unchanged (already correct — "fogászat" is the field term, not the banned noun).

### 3. Repo mirrors
- `docs/retell-agent-prompt.md` — added the `### Hungarian Terminology` section.
- `workflows/retell-custom-function-router-v2.json` — same `new_patient_info` HU fix in the FAQ Handler node.

## Dev test procedure (prod stays safe — do NOT re-publish)
1. `pnpm retell:set-webhooks -- --base https://n8ndev.appointer.hu --dry-run`, then without `--dry-run`. Repoints the **draft** agent webhook + LLM tool URLs to n8ndev. **Do not re-publish.**
2. Apply the glossary: `RETELL_API_KEY=… node workflows/scripts/retell-add-language.mjs` (dry-run first — verified prompt 23384 → 24252).
3. n8ndev FAQ fix — already applied.
4. **Test Call in the Retell dashboard** (uses the draft), speaking Hungarian: ask "mit hozzak új páciensként?" and walk a booking.
5. Verify (below), then stop. Promotion to prod is a separate, explicit step.

## Verification
- **Prompt applied:** `retell_get_llm` for `llm_9144…` → `general_prompt` contains "### Hungarian Terminology", "fogorvos", "never say \"fogász\"".
- **n8ndev FAQ:** `curl -X POST https://n8ndev.appointer.hu/webhook/retell-custom-functions -d '{"name":"get_faq_answer","args":{"topic":"new_patient_info","language":"hu"}}'` → contains "személyi igazolvány" + "TAJ", not "biztosítási kártya". (Confirm the exact routing payload first.)
- **End-to-end voice:** after the dev Test Call, pull the transcript (`retell_get_call` / `pnpm retell:save-transcript`) and scan: "fogorvos" (never "fogász"), "tisztítás"/"fogkőeltávolítás", new-patient answer names személyi igazolvány + TAJ.
- **Full booking test note:** exercising the booking flow on dev requires n8ndev's router HTTP nodes to reach a live API — confirm they point at `https://sunshinedev.appointer.hu/api` (historically a local ngrok tunnel). Glossary + FAQ are testable without booking.

## Promotion to prod (LATER)
1. `pnpm retell:set-webhooks` (default → n8nprod) + apply the same `new_patient_info` fix on the **n8nprod** router.
2. **Publish** the agent (promotes glossary + prod webhooks together; rollback = previous published version).
3. The glossary is already on the shared LLM, so publishing is the promotion.

## Known related gap (out of scope, flagged)
The router's **Localize Email** node (the *voice* booking-confirmation email) still says "biztosítási kártyáját" in HU — the voice equivalent of the chat email we already corrected. Not changed here; fix later if desired.

## Risks / notes
- Shared LLM is the main risk — never re-publish during dev testing.
- The daily-date cron PATCHes `general_prompt`; the glossary is a separate section away from the `{{current_date}}` line, so they coexist (insert is idempotent).
- No dev-clone of the Retell agent exists yet — publish-gate discipline is the isolation mechanism.
