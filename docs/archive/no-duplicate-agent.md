I have duplicated the backend app including the n8n workflow and created a dev and prod environments.
Shall I create a dev and a prod agent too ? After a successful test how to upgrade the prod ? How to move the changes from dev to prod ?



Great question. For Retell, you almost certainly do not need two separate agents. Retell has built-in versioning + environment tags designed for exactly this dev/prod split, and it's cleaner than maintaining duplicate agents that you'd have to keep manually in sync.

Recommendation: one agent, staging + prod tags
Every agent ships with prod and staging environment tags by default (you can create up to 10 total). Each tag carries:

A pointer to a specific published version, and
Its own set of environment dynamic variables (key/value pairs injected when that tag is active).
That last part is what maps onto your duplicated backend: point your n8n/webhook URLs at a dynamic variable (e.g. {{backend_base_url}}), then set that variable to the dev URL on the staging tag and the prod URL on the prod tag. Same agent, correct backend per environment, no duplication.

Why this beats two agents
No manual copying of prompt/flow changes between a "dev agent" and a "prod agent" — the whole point of versioning is that changes stay in one place.
Phone numbers, web calls, and API calls can reference a tag instead of a hard version, so promoting a release is a single tag move.
The workflow
Develop: create a new draft from the current version and make your edits. Drafts are editable; published versions are immutable.
Test against dev: attach the staging tag to that draft (staging injects your dev backend URL). Run web/phone/simulation tests. In API/SDK calls, reference agent_version: "staging".
Publish: once it passes, publish the draft. It becomes an immutable version (e.g. V3).
Promote to prod: move the prod tag from the old version to the newly published one. Everything pointing at prod (phone numbers, webhooks, API calls using version: "prod") switches over instantly — no rerouting.
That tag move is how you "move changes from dev to prod": you're not re-applying edits, you're repointing the prod tag to the version you already tested.

How to reference environments in code
text
Copy
client.agent.retrieve("agent_id", { version: "staging" })  // dev
client.agent.retrieve("agent_id", { version: "prod" })     // live
A version reference can be a number, latest, or a tag like prod/staging.

When a separate agent does make sense
Keep it to one agent unless you need hard isolation — e.g. a completely different phone number pool, separate billing/reporting boundaries, or you want dev experiments to never risk touching prod config at all. For a standard dev→prod promotion pipeline, versions + tags are the intended path.

Also worth knowing: Retell supports A/B testing if you later want to run two versions against live traffic simultaneously.

Docs: https://docs.retellai.com/agent/version and https://docs.retellai.com/deploy/ab-testing

Want me to help set up the dynamic variable for your backend URL so it swaps automatically between your dev and prod n8n endpoints?

###conductor replied

This is a single-prompt agent, and all six custom functions hardcode the same prod URL: https://n8nprod.appointer.hu/webhook/retell-custom-functions. Custom function URLs support dynamic variables, so the fix is to replace the host portion with a variable and set its value per environment tag.

Let me load the editing tools.


Finished 1 sub task
Custom function URLs accept {{variable}} substitution, so I'll parameterize just the host and keep the path fixed. Here's the setup:

Variable: backend_base_url New URL for all six functions: {{backend_base_url}}/webhook/retell-custom-functions

I'll also set a default value of the current prod host so untagged/live calls never break, then you override it per environment tag.


Finished 1 sub task
I've proposed rewriting all six custom function URLs to {{backend_base_url}}/webhook/retell-custom-functions, with a default value of your current prod host so nothing breaks on untagged/live calls.

What's in the proposal
book_appointment, cancel_appointment, get_faq_answer, capture_patient_info, check_availability, list_available_providers — host swapped to the {{backend_base_url}} variable, paths and all parameters unchanged.
Default dynamic variable backend_base_url = https://n8nprod.appointer.hu (fallback when no tag supplies it).
One step you must do in the dashboard
I can't set environment-tag dynamic variables through here — those live in the Configure Tags modal. After you accept this proposal:

Agent header → Environment → Configure Tags.
On the staging tag, add dynamic variable backend_base_url = your dev n8n host (e.g. https://n8ndev.appointer.hu).
On the prod tag, add backend_base_url = https://n8nprod.appointer.hu.
Now the same agent hits dev when running under the staging tag and prod under the prod tag — no duplicated functions to keep in sync.

Notes
I only parameterized the host. If your dev environment also changes the path, tell me and I'll move more of the URL into the variable.
Precedence: a tag's dynamic variable overrides the default I set, and a value passed in the call request overrides both. So the default is purely a safety net.
Double-check your dev host spelling before saving the tag — an unset/typo'd variable would send requests to the wrong place.
Want me to also confirm your staging/prod tag names exist, or help wire the same variable into anything else (webhook URL, prompt references)?



Review changes
Submitted
GLOBAL (2)
Functions
7 -> 7 functions: end_call, book_appointment +5 more
Accepted
Default Dynamic Variables
1 change
Accepted

Finished 1 sub task
Both changes are applied. Remaining step is in the dashboard (I can't set tag variables from here):

Agent header → Environment → Configure Tags.
staging tag → add backend_base_url = your dev n8n host.
prod tag → add backend_base_url = https://n8nprod.appointer.hu.
After that, run the agent under the staging tag to verify it hits dev, then publish and move the prod tag to promote. Want me to set up a simulation test to confirm the functions fire correctly before you go live? (It would be a billed run — just say the word.)



