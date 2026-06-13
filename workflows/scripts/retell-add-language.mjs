/**
 * i18n Track B — B1 + B2: make the Retell agent multilingual (en/hu/de).
 *
 * Idempotent round-trip against the live Retell LLM:
 *   B1 — insert a "### Language Handling" section into the system prompt.
 *   B2 — add an optional `language` enum (en/hu/de) to every custom-function tool.
 *
 * It fetches the current LLM, edits in place (preserving every other field), and
 * PATCHes it back. Re-running is a no-op once both edits are present.
 *
 * Usage (PowerShell):
 *   $env:RETELL_API_KEY="key_..."; node workflows/scripts/retell-add-language.mjs [--dry-run]
 *
 * retell-sdk is resolved from the local retell-mcp install.
 */
import { createRequire } from 'node:module'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const LLM_ID = 'llm_9144fb5e818b3d841e18ab084b99'
const DRY_RUN = process.argv.includes('--dry-run')

const apiKey = process.env.RETELL_API_KEY
if (!apiKey) {
  console.error('RETELL_API_KEY env var is required.')
  process.exit(1)
}

const LANG_SECTION = `### Language Handling

This clinic is in Hungary and serves English-, Hungarian-, and German-speaking patients. You are fully multilingual and converse naturally in all three.

- **Open** with a short greeting in Hungarian and English (e.g., "Sunshine Dental, jó napot kívánok! How can I help you?"). From the caller's first turn or two, **detect their language** — English, Hungarian, or German.
- **Conduct the entire rest of the call in the caller's language**: every greeting, question, slot read-back, confirmation, and closing. If the caller switches languages, switch with them.
- Language codes: \`en\` (English), \`hu\` (Hungarian), \`de\` (German). Default to \`en\` only if the language is genuinely unclear.
- **Relay tool output in the caller's language.** The availability, booking, FAQ, and email functions return data and text in English. Do NOT read English text verbatim to a Hungarian or German caller — translate it and phrase it naturally in their language (doctor names and email addresses stay as-is).
- **Pass the detected language to every custom function** via the \`language\` parameter (\`en\`, \`hu\`, or \`de\`), so the office can localize the FAQ answers and the confirmation email. Always set it.
- Speak numbers, dates, and times naturally in the caller's language, while still passing dates to functions in \`YYYY-MM-DD\` and times in 24-hour \`HH:MM\`.

`

const LANGUAGE_PARAM = {
  type: 'string',
  description:
    "The caller's detected language, for localizing FAQ answers and the confirmation email. One of: en (English), hu (Hungarian), de (German).",
  enum: ['en', 'hu', 'de'],
}

const client = new Retell({ apiKey })

const llm = await client.llm.retrieve(LLM_ID)

// ---- B1: prompt section -------------------------------------------------
let prompt = llm.general_prompt
let promptChanged = false
if (prompt.includes('### Language Handling')) {
  console.log('B1: Language Handling section already present — skipping.')
} else {
  const anchor = '### Core Responsibilities'
  if (!prompt.includes(anchor)) {
    console.error(`B1: anchor "${anchor}" not found; aborting to avoid a bad edit.`)
    process.exit(1)
  }
  prompt = prompt.replace(anchor, `${LANG_SECTION}${anchor}`)
  promptChanged = true
  console.log('B1: inserted Language Handling section before "### Core Responsibilities".')
}

// ---- B2: language param on every custom tool ----------------------------
let toolsChanged = false
const tools = (llm.general_tools ?? []).map((tool) => {
  if (tool.type !== 'custom') return tool
  const props = tool.parameters?.properties ?? {}
  if (props.language) {
    console.log(`B2: "${tool.name}" already has language — skipping.`)
    return tool
  }
  toolsChanged = true
  console.log(`B2: adding language to "${tool.name}".`)
  return {
    ...tool,
    parameters: {
      ...tool.parameters,
      properties: { ...props, language: LANGUAGE_PARAM },
    },
  }
})

if (!promptChanged && !toolsChanged) {
  console.log('\nNothing to do — agent already multilingual.')
  process.exit(0)
}

if (DRY_RUN) {
  console.log('\n--dry-run: no changes sent. Prompt length', prompt.length, '(was', llm.general_prompt.length, ')')
  process.exit(0)
}

const payload = {}
if (promptChanged) payload.general_prompt = prompt
if (toolsChanged) payload.general_tools = tools

await client.llm.update(LLM_ID, payload)
console.log('\nUpdated LLM', LLM_ID, '— fields:', Object.keys(payload).join(', '))
