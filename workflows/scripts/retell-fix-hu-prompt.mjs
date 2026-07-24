/**
 * Follow-up fix (round 3): stop the agent from opening with a "Dear Sir or
 * Madam"-style salutation in Hungarian.
 *
 * During testing the GPT-5.6 Terra agent said "Kedves úr vagy asszonyom",
 * which the existing rule ("Never use gendered honorifics such as 'Hölgyem'
 * or 'Uram'") did not catch because it combines both genders. This tightens
 * that rule and adds the exact phrase to the "Avoid" list.
 *
 * Fetches the current LLM, edits in place (preserving every other field),
 * asserts each anchor matches exactly once, then PATCHes it back.
 *
 * Usage (PowerShell):
 *   $env:RETELL_API_KEY="key_..."; node workflows/scripts/retell-fix-hu-prompt.mjs [--dry-run]
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire('C:/devs/retell-mcp/')
const Retell = require('retell-sdk').default ?? require('retell-sdk').Retell ?? require('retell-sdk')

const LLM_ID = 'llm_9144fb5e818b3d841e18ab084b99'
const DRY_RUN = process.argv.includes('--dry-run')

let apiKey = process.env.RETELL_API_KEY
if (!apiKey) {
  try {
    const cfg = JSON.parse(readFileSync(new URL('../../.mcp.json', import.meta.url)))
    apiKey = cfg.mcpServers?.['retell-ai']?.env?.RETELL_API_KEY
  } catch {}
}
if (!apiKey) {
  console.error('RETELL_API_KEY not found in env or .mcp.json.')
  process.exit(1)
}

function replaceOnce(text, oldStr, newStr, label) {
  const count = text.split(oldStr).length - 1
  if (count !== 1) {
    console.error(`"${label}": anchor found ${count} times (expected exactly 1) — aborting to avoid a bad edit.`)
    console.error('Anchor was:', JSON.stringify(oldStr))
    process.exit(1)
  }
  console.log(`OK: "${label}" — applying edit.`)
  return text.split(oldStr).join(newStr)
}

const client = new Retell({ apiKey })
const llm = await client.llm.retrieve(LLM_ID)
let prompt = llm.general_prompt

writeFileSync(new URL('../../docs/retell-hu-prompt-backup-2026-07-20.txt', import.meta.url), prompt, 'utf8')

// 1. Tighten the honorific rule so it also bans combined / generic salutations.
prompt = replaceOnce(
  prompt,
  '* Never use gendered honorifics such as “Hölgyem” or “Uram”.',
  '* Never use gendered or generic salutations such as “Hölgyem”, “Uram”, “Asszonyom”, “Kedves Uram”, “Kedves Asszonyom”, or “Kedves úr vagy asszonyom”. Do not use any “Dear Sir/Madam”-style opener. Just speak politely with “Ön”, and once you know the caller’s name, use their name.',
  '1. tighten honorific rule (ban combined/generic salutations)'
)

// 2. Add the exact offending phrase to the "Avoid these Hungarian phrases" list.
prompt = replaceOnce(
  prompt,
  '* “Hogyan asszisztálhatok Önnek?”\n',
  '* “Hogyan asszisztálhatok Önnek?”\n* “Kedves úr vagy asszonyom.” (and any “Uram”, “Asszonyom”, or “Dear Sir/Madam”-style salutation)\n',
  '2. add "Kedves úr vagy asszonyom" to the Avoid list'
)

writeFileSync(new URL('../../docs/retell-hu-prompt-new-2026-07-20.txt', import.meta.url), prompt, 'utf8')

if (DRY_RUN) {
  console.log('\n--dry-run: no changes sent. New prompt length', prompt.length, '(was', llm.general_prompt.length, ')')
  console.log('Wrote docs/retell-hu-prompt-backup-2026-07-20.txt and docs/retell-hu-prompt-new-2026-07-20.txt for review.')
  process.exit(0)
}

await client.llm.update(LLM_ID, { general_prompt: prompt })
console.log('\nUpdated LLM', LLM_ID, '— banned "Kedves úr vagy asszonyom" / generic salutations.')
