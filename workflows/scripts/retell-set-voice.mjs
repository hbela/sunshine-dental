/**
 * Point the production "Dental Clinic" agent at the cloned ElevenLabs voice
 * ("sunshine", a BYOK custom voice) and keep openai-Chloe as a runtime fallback.
 *
 * Why a fallback: a custom BYOK voice reaches ElevenLabs live, per utterance, so
 * it can fail mid-call (quota, API hiccup, model mismatch). fallback_voice_ids
 * lets Retell drop to a working voice instead of dropping the call. openai-Chloe
 * is the previous production voice — cheap and multilingual (en/hu/de) — so it is
 * the natural safety net.
 *
 * Idempotent: retrieves the agent, patches only when voice_id / fallback drift,
 * and no-ops when already in sync. Safe to re-run.
 *
 * Usage (PowerShell):
 *   node workflows/scripts/retell-set-voice.mjs [--dry-run]
 *   pnpm retell:set-voice
 *
 * RETELL_API_KEY is read from the env first, else from ../../.mcp.json
 * (mcpServers["retell-ai"].env), which is gitignored. retell-sdk is resolved
 * from the local retell-mcp install — same convention as retell-voice-audition.mjs.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

// ── Target: production Dental Clinic agent + the Cartesia voice ──────────────
const AGENT_ID = 'agent_0c73886e96f6cf2ad878def30e'
const VOICE_ID = 'cartesia-Chloe' // predefined Cartesia voice (live since agent v2; replaced the ElevenLabs BYOK "sunshine" clone)
const FALLBACK_VOICE_IDS = ['openai-Chloe'] // previous prod voice — cheap, multilingual

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

function sameFallback(a, b) {
  const x = Array.isArray(a) ? a : []
  return x.length === b.length && b.every((id, i) => x[i] === id)
}

async function main() {
  const client = new Retell({ apiKey: resolveApiKey() })

  const agent = await client.agent.retrieve(AGENT_ID)
  console.log(`Agent "${agent.agent_name}" (${AGENT_ID})`)
  console.log(`  current voice_id       : ${agent.voice_id}`)
  console.log(`  current fallback_voices: ${JSON.stringify(agent.fallback_voice_ids ?? [])}`)

  const needsVoice = agent.voice_id !== VOICE_ID
  const needsFallback = !sameFallback(agent.fallback_voice_ids, FALLBACK_VOICE_IDS)

  if (!needsVoice && !needsFallback) {
    console.log('\n✅ Already in sync — nothing to do.')
    return
  }

  console.log('\nPlanned changes:')
  if (needsVoice) console.log(`  voice_id        : ${agent.voice_id} → ${VOICE_ID}  (sunshine)`)
  if (needsFallback)
    console.log(`  fallback_voices : ${JSON.stringify(agent.fallback_voice_ids ?? [])} → ${JSON.stringify(FALLBACK_VOICE_IDS)}`)

  if (DRY_RUN) {
    console.log('\n[dry-run] no changes written.')
    return
  }

  const updated = await client.agent.update(AGENT_ID, {
    voice_id: VOICE_ID,
    fallback_voice_ids: FALLBACK_VOICE_IDS,
  })

  console.log('\n✅ Patched.')
  console.log(`  voice_id       : ${updated.voice_id}`)
  console.log(`  fallback_voices: ${JSON.stringify(updated.fallback_voice_ids ?? [])}`)
  console.log('\nTest it: open the agent in the Retell dashboard → "Test Audio", and')
  console.log('listen to the EN / HU / DE greeting. If sunshine ever fails, Retell')
  console.log('falls back to openai-Chloe automatically.')
}

main().catch((err) => {
  console.error('\nSet-voice failed:', err?.message ?? err)
  process.exitCode = 1
})
