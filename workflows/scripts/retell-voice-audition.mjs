/**
 * Voice-engine A/B audition — let the clinic compare TTS engines on the SAME
 * en/hu/de lines so they can decide whether a cheaper engine than ElevenLabs is
 * good enough over the phone (esp. for Hungarian, the hard case).
 *
 * What it builds (all NON-destructive — the production "Dental Clinic" agent and
 * its LLM are left completely untouched):
 *
 *   1. One dedicated "audition" Retell LLM whose begin_message recites a fixed
 *      trilingual sample (greeting + doctor name + weekday/date + time + email),
 *      i.e. exactly the spots where TTS quality and Hungarian pronunciation show.
 *   2. Three agents that all point at that audition LLM and differ ONLY by
 *      voice engine:
 *        • ElevenLabs (control) — 11labs-Marissa  (your current production voice)
 *        • Cartesia             — cartesia-Hailey  (~$0.015/min)
 *        • OpenAI               — openai-Marissa   (~$0.015/min)
 *
 * To audition: open each agent in the Retell dashboard and click "Test Audio"
 * (a browser mic call, no telephony charge). Each call opens by speaking the
 * same en→hu→de paragraph in that engine's voice. Compare the three back-to-back.
 *
 * Idempotent: re-running reuses the audition LLM + agents (matched by name) and
 * only patches drift (voice_id, llm_id, begin_message). Safe to run repeatedly.
 *
 * Usage (PowerShell):
 *   node workflows/scripts/retell-voice-audition.mjs [--dry-run]
 *
 * RETELL_API_KEY is read from the env first, else from ../../.mcp.json
 * (mcpServers["retell-ai"].env), which is gitignored. retell-sdk is resolved
 * from the local retell-mcp install.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

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

// ── The fixed audition script (identical across all three engines) ──────────
// Covers the pronunciation-sensitive spots: clinic name, doctor proper noun,
// weekday + date, time-of-day, and an email reference. Hungarian and German
// are where the cheaper engines tend to fall down — listen to those closely.
const BEGIN_MESSAGE = [
  "Hi, this is Sunshine Dental. Your appointment with Doctor Nagy is confirmed for Tuesday, June sixteenth at two thirty in the afternoon. A confirmation has been sent to your email.",
  "Jó napot kívánok, itt a Sunshine Dental. Időpontját Doktor Nagynál keddre, június tizenhatodikára, délután fél háromra rögzítettük. A megerősítést elküldtük e-mailben.",
  "Guten Tag, hier ist Sunshine Dental. Ihr Termin bei Doktor Nagy ist für Dienstag, den sechzehnten Juni um halb drei nachmittags bestätigt. Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.",
].join('\n\n')

const AUDITION_PROMPT =
  'You are a voice-sample player for an internal text-to-speech audition. ' +
  'Your begin message recites a fixed three-language sample (English, Hungarian, German). ' +
  'If the caller says anything at all, simply recite the exact same three-language sample again, ' +
  'verbatim and in the same order, and nothing else. Do not answer questions, do not improvise, ' +
  'do not add words. After reciting, wait.'

const PREFIX = 'Voice Audition — '
const VARIANTS = [
  { label: 'ElevenLabs (Marissa) [control]', voice_id: '11labs-Marissa' },
  { label: 'Cartesia (Hailey)', voice_id: 'cartesia-Hailey' },
  { label: 'OpenAI (Marissa)', voice_id: 'openai-Marissa' },
]

function die(msg) {
  throw new Error(msg)
}

async function main() {
  const client = new Retell({ apiKey: resolveApiKey() })

  // ── Find existing audition agents so re-runs reuse the same LLM ───────────
  // POST /v2/list-agents returns { items, pagination_key } (not a bare array).
  const { items: agents = [] } = await client.agent.list()
  const auditionAgents = agents.filter((a) => (a.agent_name ?? '').startsWith(PREFIX))
  let llmId = auditionAgents[0]?.response_engine?.llm_id ?? null

  // ── Audition LLM: create once, keep its begin_message in sync ─────────────
  if (!llmId) {
    if (DRY_RUN) {
      console.log('[dry-run] would CREATE audition LLM (model gpt-4.1, trilingual begin_message)')
      llmId = '<new-llm-id>'
    } else {
      const llm = await client.llm.create({
        model: 'gpt-4.1',
        general_prompt: AUDITION_PROMPT,
        begin_message: BEGIN_MESSAGE,
      })
      llmId = llm.llm_id
      console.log('Created audition LLM', llmId)
    }
  } else {
    const llm = await client.llm.retrieve(llmId)
    const drift =
      llm.begin_message !== BEGIN_MESSAGE || llm.general_prompt !== AUDITION_PROMPT
    if (drift && !DRY_RUN) {
      await client.llm.update(llmId, {
        general_prompt: AUDITION_PROMPT,
        begin_message: BEGIN_MESSAGE,
      })
      console.log('Reused audition LLM', llmId, '— refreshed begin_message/prompt.')
    } else {
      console.log(`Reused audition LLM ${llmId}${drift ? ' (dry-run: would refresh)' : ' (in sync).'}`)
    }
  }

  // ── One agent per voice engine, all sharing the audition LLM ──────────────
  const results = []
  for (const v of VARIANTS) {
    const name = PREFIX + v.label
    const existing = agents.find((a) => a.agent_name === name)
    const engine = { type: 'retell-llm', llm_id: llmId }

    if (!existing) {
      if (DRY_RUN) {
        console.log(`[dry-run] would CREATE agent "${name}" (voice ${v.voice_id})`)
        results.push({ name, voice: v.voice_id, agent_id: '<new>', action: 'create' })
        continue
      }
      const created = await client.agent.create({
        agent_name: name,
        voice_id: v.voice_id,
        language: 'multi',
        response_engine: engine,
      })
      console.log(`Created "${name}" → ${created.agent_id} (voice ${v.voice_id})`)
      results.push({ name, voice: v.voice_id, agent_id: created.agent_id, action: 'create' })
    } else {
      const needsVoice = existing.voice_id !== v.voice_id
      const needsLlm = existing.response_engine?.llm_id !== llmId
      if ((needsVoice || needsLlm) && !DRY_RUN) {
        await client.agent.update(existing.agent_id, {
          voice_id: v.voice_id,
          response_engine: engine,
        })
      }
      const note = needsVoice || needsLlm ? (DRY_RUN ? 'would patch' : 'patched') : 'in sync'
      console.log(`Reused "${name}" → ${existing.agent_id} (${note})`)
      results.push({ name, voice: v.voice_id, agent_id: existing.agent_id, action: note })
    }
  }

  // ── How to listen ─────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────────')
  console.log('A/B VOICE AUDITION READY')
  console.log('──────────────────────────────────────────────────────────────')
  for (const r of results) {
    console.log(`  ${r.voice.padEnd(18)}  ${r.agent_id}   (${r.name})`)
  }
  console.log('\nTo listen (no telephony charge):')
  console.log('  1. Open https://dashboard.retellai.com/agents')
  console.log('  2. Open each "Voice Audition — …" agent and click "Test Audio".')
  console.log('  3. On connect it speaks the same EN → HU → DE sample. Say "again" to repeat.')
  console.log('  4. Focus on the HUNGARIAN paragraph — that is where cheap engines break.')
  console.log('\nWhen the client has decided, delete the audition agents/LLM from the dashboard,')
  console.log('or just switch the production agent\'s voice_id to the winner.')
}

main().catch((err) => {
  console.error('\nAudition setup failed:', err?.message ?? err)
  process.exitCode = 1
})
