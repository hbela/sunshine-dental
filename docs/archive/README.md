# docs/archive/

Documents describing the **retired voice agent** (Retell AI), moved here on **2026-08-18**.

They are kept because the completed plan documents in `docs/` reference them: they record
*why* several refactors were done — the shared prompt core, the services-as-config change,
the i18n rollout — and deleting them would leave that reasoning dangling. Nothing here
describes how the product works now.

For the current system see [`../onboarding-new-clinic.md`](../onboarding-new-clinic.md),
[`../deploy.md`](../deploy.md), and [`../voice-agent-retirement.md`](../voice-agent-retirement.md).

| File | What it was |
|---|---|
| `retell-agent-prompt.md` | Hand-maintained copy of the voice agent's system prompt. |
| `retell-custom-functions.md` | The 6 custom-function contracts the voice agent called. |
| `retell-golive.md` | Checklist for publishing an agent and attaching a phone number. Never completed — no number was ever provisioned. |
| `retell-dev-prod-split-plan.md` | Plan for pointing one agent at dev vs prod backends. |
| `retell-hu-glossary-dev-plan.md` | Hungarian dental glossary work. **Its outcome lives on** in `apps/api/src/prompts/dental-pack.ts` — the glossary was the part of the voice work worth keeping, and the chat agent uses it. |
| `no-duplicate-agent.md` | Why there was one agent per clinic, flipped between backends. |
| `embed-call-recording-plan.md` | Plan for embedding a call recording in the user guide. |
| `more_realistic_conversation.md` | Notes on making voice conversations sound less scripted. |
| `retell-hu-prompt-backup-2026-07-20.txt`, `retell-hu-prompt-new-2026-07-20.txt` | Before/after snapshots of the Hungarian voice prompt from the glossary work. |
