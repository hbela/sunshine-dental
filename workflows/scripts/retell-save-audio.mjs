#!/usr/bin/env node
/**
 * Download a Retell call's audio recording to docs/transcripts/<call_id>.wav.
 *
 * Retell stores each call's audio on CloudFront and exposes it on the call
 * object as `recording_url` (single mixed channel) and
 * `recording_multi_channel_url` (agent + caller on separate stereo channels).
 * These URLs are public unless the call has `opt_in_signed_url = true`.
 *
 * Usage:
 *   node workflows/scripts/retell-save-audio.mjs <call_id>   # a specific call
 *   node workflows/scripts/retell-save-audio.mjs --latest    # most recent call
 *   node workflows/scripts/retell-save-audio.mjs             # same as --latest
 *   node workflows/scripts/retell-save-audio.mjs --latest --agent <agent_id>
 *   node workflows/scripts/retell-save-audio.mjs --latest --multi   # stereo/multichannel
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
const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const agentId = flag('--agent');
const wantMulti = has('--multi');
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

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Retell({ apiKey: resolveApiKey() });

  let callId = callIdArg;
  if (!callId) {
    const list = await client.call.list({
      limit: 1,
      ...(agentId ? { filter_criteria: { agent_id: [agentId] } } : {}),
    });
    const items = Array.isArray(list) ? list : list?.items ?? list?.data ?? [];
    if (!items.length) {
      console.error('No calls found.');
      process.exit(1);
    }
    callId = items[0].call_id;
    console.log(`Latest call: ${callId}`);
  }

  const call = await client.call.retrieve(callId);
  const url = wantMulti ? call.recording_multi_channel_url : call.recording_url;
  if (!url) {
    console.error(
      `No ${wantMulti ? 'multichannel ' : ''}recording URL on this call yet ` +
        '(recording may still be processing, or was disabled for the agent).',
    );
    process.exit(1);
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  mkdirSync(OUT_DIR, { recursive: true });
  const suffix = wantMulti ? '.multichannel.wav' : '.wav';
  const file = resolve(OUT_DIR, `${call.call_id}${suffix}`);
  writeFileSync(file, buf);
  console.log(`Wrote ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
