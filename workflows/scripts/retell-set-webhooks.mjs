/**
 * Repoint the production "Dental Clinic" agent's n8n webhooks from one n8n host
 * to another (dev → prod split). Patches, in one idempotent SDK round-trip:
 *
 *   • agent.webhook_url                 → <base>/webhook/retell-post-call
 *   • every custom LLM tool's `url`     → <base>/webhook/retell-custom-functions
 *
 * The 6 custom tools (check_availability, list_available_providers, book_appointment,
 * cancel_appointment, get_faq_answer, capture_patient_info) all share the one router
 * webhook; end_call (a built-in, urlless tool) is left untouched. The Retell MCP only
 * exposes prompt updates, so tool-URL edits must go through the SDK — same technique as
 * retell-add-language.mjs / retell-set-voice.mjs.
 *
 * NB: after this runs you must RE-PUBLISH the agent in the Retell dashboard — a published
 * version pins its webhook/tool config, so the change only reaches live calls on re-publish.
 *
 * Idempotent: reads current config, patches only what drifts, no-ops when in sync.
 *
 * Usage (PowerShell):
 *   node workflows/scripts/retell-set-webhooks.mjs [--dry-run] [--base https://n8nprod.appointer.hu]
 *   pnpm retell:set-webhooks -- --dry-run
 *
 * RETELL_API_KEY is read from the env first, else from ../../.mcp.json
 * (mcpServers["retell-ai"].env), which is gitignored. retell-sdk is resolved from the
 * local retell-mcp install — same convention as the other retell-*.mjs scripts.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Targets ─────────────────────────────────────────────────────────────────
const AGENT_ID = 'agent_0c73886e96f6cf2ad878def30e'
const LLM_ID = 'llm_9144fb5e818b3d841e18ab084b99'
const DEFAULT_BASE = 'https://n8nprod.appointer.hu'

const POST_CALL_PATH = '/webhook/retell-post-call'
const CUSTOM_FN_PATH = '/webhook/retell-custom-functions'

// ── Args ────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`))
  return eq ? eq.slice(flag.length + 1) : undefined
}
const BASE = (argValue('--base') ?? DEFAULT_BASE).replace(/\/+$/, '')
const WEBHOOK_URL = BASE + POST_CALL_PATH
const CUSTOM_FN_URL = BASE + CUSTOM_FN_PATH

// ── Resolve the Retell API key (env → ../../.mcp.json) ──────────────────────
function resolveApiKey() {
  if (process.env.RETELL_API_KEY) return process.env.RETELL_API_KEY
  try {
    const mcp = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '.mcp.json'), 'utf8'))
    const key = mcp?.mcpServers?.['retell-ai']?.env?.RETELL_API_KEY
    if (key) return key
  } catch {
    /* .mcp.json absent — fall through */
  }
  throw new Error('RETELL_API_KEY not found in env or ../../.mcp.json')
}

async function main() {
  const client = new Retell({ apiKey: resolveApiKey() })
  console.log(`Target n8n base: ${BASE}${DRY_RUN ? '   [dry-run]' : ''}`)

  // ── Agent post-call webhook ───────────────────────────────────────────────
  const agent = await client.agent.retrieve(AGENT_ID)
  const agentNeeds = agent.webhook_url !== WEBHOOK_URL
  console.log(`\nAgent "${agent.agent_name}" (${AGENT_ID})`)
  console.log(`  webhook_url: ${agent.webhook_url ?? '(none)'}`)
  if (agentNeeds) console.log(`            → ${WEBHOOK_URL}`)

  // ── LLM custom-tool URLs ──────────────────────────────────────────────────
  const llm = await client.llm.retrieve(LLM_ID)
  const tools = llm.general_tools ?? []
  const customTools = tools.filter((t) => t.type === 'custom')
  const toolsNeeding = customTools.filter((t) => t.url !== CUSTOM_FN_URL)

  console.log(`\nLLM ${LLM_ID} — ${customTools.length} custom tools`)
  const distinctUrls = [...new Set(customTools.map((t) => t.url))]
  for (const u of distinctUrls) {
    const n = customTools.filter((t) => t.url === u).length
    console.log(`  ${n}× ${u}${u === CUSTOM_FN_URL ? '  (already target)' : ''}`)
  }
  if (toolsNeeding.length) console.log(`            → ${CUSTOM_FN_URL}  (${toolsNeeding.length} tool${toolsNeeding.length > 1 ? 's' : ''})`)

  if (!agentNeeds && toolsNeeding.length === 0) {
    console.log('\n✅ Already in sync — nothing to do.')
    return
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] no changes written.')
    console.log('Apply with: node workflows/scripts/retell-set-webhooks.mjs' + (argValue('--base') ? ` --base ${BASE}` : ''))
    return
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  if (agentNeeds) {
    await client.agent.update(AGENT_ID, { webhook_url: WEBHOOK_URL })
    console.log('\n✅ Agent webhook_url patched.')
  }
  if (toolsNeeding.length) {
    const newTools = tools.map((t) => (t.type === 'custom' ? { ...t, url: CUSTOM_FN_URL } : t))
    await client.llm.update(LLM_ID, { general_tools: newTools })
    console.log(`✅ Patched ${toolsNeeding.length} custom tool URL(s).`)
  }

  console.log('\n⚠️  Re-publish the "Dental Clinic" agent in the Retell dashboard for this to')
  console.log('    take effect on live calls (published versions pin webhook/tool config).')
}

main().catch((err) => {
  console.error('\nSet-webhooks failed:', err?.message ?? err)
  process.exitCode = 1
})
