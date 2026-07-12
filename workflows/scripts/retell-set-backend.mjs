/**
 * Switch the single Retell agent between the prod and dev n8n backends by the
 * **dynamic-variable** method (the current setup), NOT by hardcoding tool URLs.
 *
 * The custom tools' `url` is the template `{{backend_base_url}}/webhook/...`, so
 * flipping the whole agent is just two edits:
 *   1. LLM `default_dynamic_variables.backend_base_url`  → the n8n base (tool calls)
 *   2. Agent `webhook_url`  → <base>/webhook/retell-post-call  (post-call flow)
 *
 * This does NOT touch the individual tool URLs (leaving the {{backend_base_url}}
 * templates intact) — that's the difference from retell-set-webhooks.mjs.
 *
 * Idempotent: only writes drift. Edits the DRAFT; live calls use the published
 * version until you re-publish the agent (so dev testing never affects prod).
 *
 * Usage:
 *   node workflows/scripts/retell-set-backend.mjs --base https://n8ndev.appointer.hu [--dry-run]
 *   node workflows/scripts/retell-set-backend.mjs            # defaults to n8nprod (restore)
 *
 * RETELL_API_KEY from env, else the gitignored ../../.mcp.json (retell-ai server).
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const AGENT_ID = 'agent_0c73886e96f6cf2ad878def30e'
const LLM_ID = 'llm_9144fb5e818b3d841e18ab084b99'
const POST_CALL_PATH = '/webhook/retell-post-call'
const DEFAULT_BASE = 'https://n8nprod.appointer.hu'
const DRY_RUN = process.argv.includes('--dry-run')

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function resolveApiKey() {
  if (process.env.RETELL_API_KEY) return process.env.RETELL_API_KEY
  const mcp = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '.mcp.json'), 'utf8'))
  const key = mcp?.mcpServers?.['retell-ai']?.env?.RETELL_API_KEY
  if (key) return key
  throw new Error('RETELL_API_KEY not found in env or ../../.mcp.json')
}

const BASE = (argValue('--base') ?? DEFAULT_BASE).replace(/\/+$/, '')
const WEBHOOK_URL = BASE + POST_CALL_PATH

const client = new Retell({ apiKey: resolveApiKey() })

const llm = await client.llm.retrieve(LLM_ID)
const agent = await client.agent.retrieve(AGENT_ID)

const curBackend = llm.default_dynamic_variables?.backend_base_url
const curWebhook = agent.webhook_url

console.log('Target base       :', BASE)
console.log('backend_base_url  :', curBackend, curBackend === BASE ? '(already set)' : `→ ${BASE}`)
console.log('agent webhook_url :', curWebhook, curWebhook === WEBHOOK_URL ? '(already set)' : `→ ${WEBHOOK_URL}`)

const backendChanged = curBackend !== BASE
const webhookChanged = curWebhook !== WEBHOOK_URL

if (!backendChanged && !webhookChanged) {
  console.log('\nNothing to do — already pointed at', BASE)
  process.exit(0)
}

if (DRY_RUN) {
  console.log('\n--dry-run: no changes sent.')
  process.exit(0)
}

if (backendChanged) {
  await client.llm.update(LLM_ID, {
    default_dynamic_variables: { ...(llm.default_dynamic_variables ?? {}), backend_base_url: BASE },
  })
  console.log('Updated LLM default_dynamic_variables.backend_base_url →', BASE)
}
if (webhookChanged) {
  await client.agent.update(AGENT_ID, { webhook_url: WEBHOOK_URL })
  console.log('Updated agent webhook_url →', WEBHOOK_URL)
}

console.log('\n⚠️  This edits the DRAFT. Live calls keep using the PUBLISHED version.')
console.log('    For a dev Test Call, use the dashboard test (draft) and do NOT publish.')
console.log('    Re-run with no --base (or --base https://n8nprod.appointer.hu) to restore prod.')
