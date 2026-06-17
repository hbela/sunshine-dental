#!/usr/bin/env node
/**
 * Export a Retell call to docs/transcripts/<call_id>.md.
 *
 * Fetches a call via the Retell SDK and writes a readable Markdown file:
 * metadata table, analysis summary, tool-call list, and the full transcript.
 *
 * Usage:
 *   node workflows/scripts/retell-save-transcript.mjs <call_id>   # a specific call
 *   node workflows/scripts/retell-save-transcript.mjs --latest    # most recent call
 *   node workflows/scripts/retell-save-transcript.mjs             # same as --latest
 *   node workflows/scripts/retell-save-transcript.mjs --latest --agent <agent_id>
 *
 * Config (no secrets committed):
 *   RETELL_API_KEY ← env var first, else parsed from ../../.mcp.json
 *                    (mcpServers["retell-ai"].env.RETELL_API_KEY), which is gitignored.
 *
 * retell-sdk is resolved from the local retell-mcp install, matching the other
 * scripts in this folder.
 */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire('C:/devs/retell-mcp/');
const RetellMod = require('retell-sdk');
const Retell = RetellMod.default ?? RetellMod.Retell ?? RetellMod;

const __dirname = dirname(fileURLToPath(import.meta.url));
// workflows/scripts → repo root is two levels up.
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'docs', 'transcripts');

// ── args ────────────────────────────────────────────────────────────────────
// <call_id>            export that call
// --latest | (none)    export the most recent call
// --agent <id>         scope --latest to one agent
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const agentId = flag('--agent');
// A positional token (not a flag and not the value of --agent) is the call id.
const callIdArg = args.find(
  (a, i) => !a.startsWith('--') && args[i - 1] !== '--agent',
);

// ── resolve RETELL_API_KEY (env → .mcp.json) ─────────────────────────────────
function resolveApiKey() {
  let key = process.env.RETELL_API_KEY;
  if (key) return key;
  try {
    const mcp = JSON.parse(readFileSync(resolve(REPO_ROOT, '.mcp.json'), 'utf8'));
    key = mcp?.mcpServers?.['retell-ai']?.env?.RETELL_API_KEY;
  } catch {
    /* .mcp.json absent — fall through */
  }
  if (!key) {
    console.error('RETELL_API_KEY not found in env or .mcp.json (mcpServers["retell-ai"].env).');
    process.exit(1);
  }
  return key;
}

// ── formatting helpers ───────────────────────────────────────────────────────
const tsUtc = (ms) =>
  ms ? new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'n/a';

function toMarkdown(call) {
  const ca = call.call_analysis ?? {};
  const cc = call.call_cost ?? {};
  const tc = call.tool_calls ?? [];
  const L = [];
  L.push('# Retell Call Transcript', '');
  L.push('| Field | Value |', '|-------|-------|');
  L.push(`| Call ID | \`${call.call_id}\` |`);
  L.push(`| Agent | ${call.agent_name ?? '—'} (\`${call.agent_id ?? '—'}\`) |`);
  L.push(`| Type | ${call.call_type ?? '—'} |`);
  L.push(`| Started | ${tsUtc(call.start_timestamp)} |`);
  L.push(`| Ended | ${tsUtc(call.end_timestamp)} |`);
  L.push(`| Duration | ${Math.round((call.duration_ms ?? 0) / 1000)} s |`);
  L.push(`| Disconnect | ${call.disconnection_reason ?? '—'} |`);
  L.push(`| Successful | ${ca.call_successful ?? '—'} |`);
  L.push(`| Sentiment | ${ca.user_sentiment ?? '—'} |`);
  L.push(`| Cost (cents) | ${cc.combined_cost ?? '—'} |`);
  L.push(`| Recording | ${call.recording_url ?? '—'} |`);
  L.push('', '## Summary', '', ca.call_summary || '(none)', '');
  L.push('## Tool calls', '');
  if (tc.length) {
    L.push('| # | Tool | t (s) | success |', '|---|------|-------|---------|');
    tc.forEach((c, i) =>
      L.push(`| ${i + 1} | ${c.name} | ${c.start_time_sec ?? '—'} | ${c.success ?? '-'} |`));
  } else {
    L.push('(none)');
  }
  L.push('', '## Transcript', '', '```', (call.transcript ?? '').trimEnd(), '```', '');
  return L.join('\n');
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Retell({ apiKey: resolveApiKey() });

  let callId = callIdArg;
  if (!callId) {
    const list = await client.call.list({ limit: 1, ...(agentId ? { filter_criteria: { agent_id: [agentId] } } : {}) });
    const items = Array.isArray(list) ? list : list?.items ?? list?.data ?? [];
    if (!items.length) {
      console.error('No calls found.');
      process.exit(1);
    }
    callId = items[0].call_id;
    console.log(`Latest call: ${callId}`);
  }

  const call = await client.call.retrieve(callId);
  if (!call?.transcript) {
    console.warn('Warning: call has no transcript yet (still in progress or not analyzed).');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${call.call_id}.md`);
  writeFileSync(file, toMarkdown(call), 'utf8');
  console.log(`Wrote ${file}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
