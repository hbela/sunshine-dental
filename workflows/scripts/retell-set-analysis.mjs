/**
 * Add a language-following post-call analysis field to the Retell agent.
 *
 * Retell's built-in `call_summary` is always English. To email the manager a
 * summary in the CALLER's language, we add a custom analysis field
 * `localized_summary` whose description instructs the analysis model to write it
 * in the language the caller spoke. The n8n post-call workflow then prefers this
 * field over `call_summary` (see the "Extract Call Data" node).
 *
 * Idempotent: skips if a `localized_summary` field is already present. Edits the
 * agent DRAFT; publish the agent to promote to live calls.
 *
 * Usage:
 *   node workflows/scripts/retell-set-analysis.mjs [--dry-run]
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
const FIELD_NAME = 'localized_summary'
const DRY_RUN = process.argv.includes('--dry-run')

const FIELD = {
  type: 'string',
  name: FIELD_NAME,
  description:
    "A concise 2-4 sentence summary of the call, written in the SAME language the caller spoke: Hungarian if the call was in Hungarian, German if in German, otherwise English. Summarize what the patient wanted and what was accomplished (e.g. appointment booked/rescheduled/cancelled, question answered, or callback logged).",
  examples: [],
}

function resolveApiKey() {
  if (process.env.RETELL_API_KEY) return process.env.RETELL_API_KEY
  const mcp = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '.mcp.json'), 'utf8'))
  const key = mcp?.mcpServers?.['retell-ai']?.env?.RETELL_API_KEY
  if (key) return key
  throw new Error('RETELL_API_KEY not found in env or ../../.mcp.json')
}

const client = new Retell({ apiKey: resolveApiKey() })

const agent = await client.agent.retrieve(AGENT_ID)
const existing = agent.post_call_analysis_data ?? []

if (existing.some((f) => f?.name === FIELD_NAME)) {
  console.log(`"${FIELD_NAME}" already present — nothing to do (${existing.length} analysis field(s)).`)
  process.exit(0)
}

const next = [...existing, FIELD]
console.log(`Adding "${FIELD_NAME}" (analysis model: ${agent.post_call_analysis_model}).`)
console.log(`post_call_analysis_data: ${existing.length} → ${next.length} field(s).`)

if (DRY_RUN) {
  console.log('\n--dry-run: no changes sent.')
  process.exit(0)
}

await client.agent.update(AGENT_ID, { post_call_analysis_data: next })
console.log('\nUpdated agent post_call_analysis_data.')
console.log('⚠️  Edits the DRAFT. Publish the agent to apply to live calls.')
