/**
 * Provision a Retell voice agent for a NEW clinic by cloning the reference one.
 *
 * Each clinic gets its own agent + LLM (own phone number, own greeting, own
 * facts, own billing line) — see `docs/onboarding-new-clinic.md` Phase 4. This
 * script does the mechanical 90%:
 *
 *   1. Reads the reference agent + LLM (Sunshine's, by default).
 *   2. Creates a NEW LLM: same model/tools/settings, with the source clinic's
 *      facts substituted for the target clinic's (name, persona, address,
 *      phone, website, hours, emergency number).
 *   3. Points every custom tool at `{{backend_base_url}}/webhook/<id>-custom-functions`
 *      and sets `default_dynamic_variables.backend_base_url`, so the agent is
 *      flipped between n8n hosts later with retell-set-backend.mjs.
 *   4. Creates a NEW agent bound to that LLM, copying voice/behaviour settings,
 *      with `webhook_url` → `<n8n base>/webhook/<id>-post-call`.
 *
 * It does NOT publish, and it does NOT buy a phone number — both are deliberate
 * dashboard steps (see retell-golive.md). It also refuses to create a second
 * agent for a clinic that already has one unless you pass --force.
 *
 * **The remaining 10% is yours:** the prompt is prose, so substitution cannot be
 * complete. The script prints every line of the new prompt that still mentions
 * the source clinic — review and fix those in the dashboard before publishing.
 *
 * Usage (PowerShell):
 *   pnpm retell:clone -- --clinic corona [--dry-run]
 *   pnpm retell:clone -- --clinic corona --base https://n8nprod.appointer.hu
 *   pnpm retell:clone -- --clinic corona --from-agent agent_xxx --from-llm llm_xxx
 *
 * RETELL_API_KEY is read from env, else from the gitignored ../../.mcp.json
 * (mcpServers["retell-ai"].env) — same convention as the other retell-*.mjs
 * scripts. retell-sdk is resolved from the local retell-mcp install.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getClinic, type ClinicConfig } from '../../packages/shared/src/clinic.js'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Reference (source) agent — Sunshine's live pair ─────────────────────────
const SOURCE_AGENT_ID = 'agent_0c73886e96f6cf2ad878def30e'
const SOURCE_LLM_ID = 'llm_9144fb5e818b3d841e18ab084b99'
const SOURCE_CLINIC_ID = 'sunshine'
const DEFAULT_N8N_BASE = 'https://n8nprod.appointer.hu'

// ── Args ────────────────────────────────────────────────────────────────────
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`))
  return eq ? eq.slice(flag.length + 1) : undefined
}
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const TARGET_ID = argValue('--clinic')
const N8N_BASE = (argValue('--base') ?? DEFAULT_N8N_BASE).replace(/\/+$/, '')
const sourceAgentId = argValue('--from-agent') ?? SOURCE_AGENT_ID
const sourceLlmId = argValue('--from-llm') ?? SOURCE_LLM_ID

if (!TARGET_ID) {
  console.error('Usage: pnpm retell:clone -- --clinic <id> [--base <n8n-url>] [--dry-run] [--force]')
  process.exit(1)
}

const source: ClinicConfig = getClinic(argValue('--from-clinic') ?? SOURCE_CLINIC_ID)
const target: ClinicConfig = getClinic(TARGET_ID)
if (target.id === source.id) {
  console.error(`Refusing to clone "${source.id}" onto itself.`)
  process.exit(1)
}

const CUSTOM_FN_URL = `{{backend_base_url}}/webhook/${target.id}-custom-functions`
const POST_CALL_URL = `${N8N_BASE}/webhook/${target.id}-post-call`
const AGENT_NAME = `${target.fullName}`

// ── API key (env → ../../.mcp.json) ─────────────────────────────────────────
function resolveApiKey(): string {
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

/**
 * Swap the source clinic's facts for the target's throughout the prompt.
 *
 * Longest strings first so a specific phrase (the full clinic name, the whole
 * hours summary) is replaced before a substring of it. Everything here is
 * mechanical — the prose around it still needs a human read.
 */
function rewritePrompt(text: string): string {
  const pairs: Array<[string, string]> = [
    [source.officeHoursSummary, target.officeHoursSummary],
    [source.contact.website, target.contact.website],
    [source.contact.email, target.contact.email],
    [source.contact.addressLine, target.contact.addressLine],
    [source.contact.postcode, target.contact.postcode],
    [source.contact.phone, target.contact.phone],
    // Phone numbers appear both spaced and compacted in prompts.
    [source.contact.phone.replace(/\s/g, ''), target.contact.phone.replace(/\s/g, '')],
    [source.fullName, target.fullName],
    [source.name, target.name],
    [source.contact.city, target.contact.city],
    [source.contact.country, target.contact.country],
    [source.personaName, target.personaName],
    [source.emergencyNumber, target.emergencyNumber],
  ]
  let out = text
  for (const [from, to] of pairs) {
    if (!from || from === to) continue
    out = out.split(from).join(to)
  }
  return out
}

/**
 * Lines that still name the source clinic after rewriting — the human's to-do
 * list. Only values that actually differ between the two clinics count: two
 * Budapest clinics share a city, and flagging every line with "Budapest" in it
 * would bury the real hits.
 */
function residue(text: string): string[] {
  const needles = [
    [source.name, target.name],
    [source.fullName, target.fullName],
    [source.contact.city, target.contact.city],
    [source.contact.phone, target.contact.phone],
    [source.contact.email, target.contact.email],
    [source.contact.website, target.contact.website],
  ]
    .filter(([from, to]) => from && from !== to)
    .map(([from]) => from!)

  return text.split('\n').filter((line) => needles.some((n) => line.includes(n)))
}

/** Copy only fields Retell accepts on create, dropping ids/timestamps and unset values. */
function pick<T extends object>(src: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = (src as Record<string, unknown>)[k]
    if (v !== undefined && v !== null) out[k] = v
  }
  return out
}

const LLM_FIELDS = [
  'model',
  'model_temperature',
  'model_high_priority',
  'tool_call_strict_mode',
  'begin_message',
  'general_prompt',
  'general_tools',
  'states',
  'starting_state',
  'knowledge_base_ids',
  'default_dynamic_variables',
] as const

const AGENT_FIELDS = [
  'voice_id',
  'fallback_voice_ids',
  'voice_model',
  'voice_temperature',
  'voice_speed',
  'volume',
  'language',
  'responsiveness',
  'interruption_sensitivity',
  'enable_backchannel',
  'backchannel_frequency',
  'backchannel_words',
  'reminder_trigger_ms',
  'reminder_max_count',
  'ambient_sound',
  'ambient_sound_volume',
  'boosted_keywords',
  'normalize_for_speech',
  'end_call_after_silence_ms',
  'max_call_duration_ms',
  'begin_message_delay_ms',
  'ring_duration_ms',
  'stt_mode',
  'vocab_specialization',
  'allow_user_dtmf',
  'denoising_mode',
  'post_call_analysis_data',
  'post_call_analysis_model',
] as const

async function main() {
  const client = new Retell({ apiKey: resolveApiKey() })
  console.log(`Cloning "${source.name}" → "${target.name}" (clinic id: ${target.id})${DRY_RUN ? '   [dry-run]' : ''}`)
  console.log(`  n8n base        : ${N8N_BASE}`)
  console.log(`  custom fn URL   : ${CUSTOM_FN_URL}`)
  console.log(`  post-call URL   : ${POST_CALL_URL}`)

  // ── Guard: does this clinic already have an agent? ─────────────────────────
  // agent.list() paginates: `{ items, has_more }` in the current SDK, a bare
  // array in older ones — tolerate both.
  const listed = await client.agent.list()
  const allAgents: any[] = Array.isArray(listed) ? listed : (listed.items ?? [])
  const existing = allAgents.filter((a) => a.agent_name === AGENT_NAME)
  if (existing.length && !FORCE) {
    console.error(
      `\n❌ An agent named "${AGENT_NAME}" already exists (${existing.map((a: any) => a.agent_id).join(', ')}).\n` +
        `   Refusing to create a duplicate — edit that one, or pass --force if you really want a second.`,
    )
    process.exit(1)
  }

  // ── Source ────────────────────────────────────────────────────────────────
  const srcAgent = await client.agent.retrieve(sourceAgentId)
  const srcLlm = await client.llm.retrieve(sourceLlmId)
  console.log(`\nSource agent "${srcAgent.agent_name}" (${sourceAgentId}) · LLM ${sourceLlmId} · model ${srcLlm.model}`)

  // ── Build the new LLM payload ─────────────────────────────────────────────
  const llmPayload = pick(srcLlm, LLM_FIELDS)
  if (typeof llmPayload.general_prompt === 'string') {
    llmPayload.general_prompt = rewritePrompt(llmPayload.general_prompt)
  }
  if (typeof llmPayload.begin_message === 'string') {
    llmPayload.begin_message = rewritePrompt(llmPayload.begin_message)
  }
  const tools = (srcLlm.general_tools ?? []) as any[]
  llmPayload.general_tools = tools.map((t) =>
    t.type === 'custom'
      ? { ...t, url: CUSTOM_FN_URL, description: rewritePrompt(String(t.description ?? '')) }
      : t,
  )
  llmPayload.default_dynamic_variables = {
    ...(srcLlm.default_dynamic_variables ?? {}),
    backend_base_url: N8N_BASE,
  }

  const customCount = tools.filter((t) => t.type === 'custom').length
  console.log(`  ${customCount} custom tools → ${CUSTOM_FN_URL}`)

  // ── What the substitution could not do ────────────────────────────────────
  const leftovers = residue(String(llmPayload.general_prompt ?? ''))
  if (leftovers.length) {
    console.log(`\n⚠️  ${leftovers.length} prompt line(s) still mention "${source.name}" — review by hand:`)
    for (const l of leftovers.slice(0, 20)) console.log(`     ${l.trim().slice(0, 160)}`)
    if (leftovers.length > 20) console.log(`     … and ${leftovers.length - 20} more`)
  } else {
    console.log(`\n✓ No remaining mentions of "${source.name}" in the prompt.`)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] nothing created. Prompt preview (first 30 lines):\n')
    console.log(String(llmPayload.general_prompt ?? '').split('\n').slice(0, 30).join('\n'))
    return
  }

  // ── Create ────────────────────────────────────────────────────────────────
  const newLlm = await client.llm.create(llmPayload as any)
  console.log(`\n✅ Created LLM ${newLlm.llm_id}`)

  const agentPayload = {
    ...pick(srcAgent, AGENT_FIELDS),
    response_engine: { type: 'retell-llm', llm_id: newLlm.llm_id },
    agent_name: AGENT_NAME,
    webhook_url: POST_CALL_URL,
  }
  const newAgent = await client.agent.create(agentPayload as any)
  console.log(`✅ Created agent ${newAgent.agent_id} ("${AGENT_NAME}")`)

  console.log(`
Next steps (docs/onboarding-new-clinic.md Phase 4):
  1. Review the prompt in the Retell dashboard — greeting, clinic facts, any line flagged above.
  2. Import the ${target.id} n8n workflows so ${POST_CALL_URL} and
     .../webhook/${target.id}-custom-functions actually resolve.
  3. PUBLISH the agent (published versions pin webhook + tool config).
  4. Buy a test number and set Inbound Agent = "${AGENT_NAME}".

Record these ids in docs/clinics/${target.id}.md:
  agent_id = ${newAgent.agent_id}
  llm_id   = ${newLlm.llm_id}
`)
}

main().catch((err) => {
  console.error(err?.message ?? err)
  process.exit(1)
})
