#!/usr/bin/env node
// Re-point the Retell n8n router's HTTP nodes at the CURRENT ngrok tunnel.
//
// Why this exists: the Retell voice agent reaches the local Fastify API through
//   Retell → n8n (n8ndev.appointer.hu) → ngrok → 127.0.0.1:3000
// ngrok hands out a NEW public URL every restart, so the workflow's HTTP nodes go
// stale and every availability/booking call returns empty — the agent then falls
// back to a callback and books nothing. This script reads the live ngrok URL and
// rewrites the node URLs in one shot.
//
// Usage:
//   node workflows/patch-ngrok-url.mjs            # patch using the live ngrok URL
//   node workflows/patch-ngrok-url.mjs --dry-run  # show what would change, no write
//   NGROK_URL=https://abc.ngrok-free.app node workflows/patch-ngrok-url.mjs  # override
//
// Config resolution (no secrets committed):
//   N8N_API_URL / N8N_API_KEY  ← env vars first, else parsed from ../.mcp.json
//                                 (mcpServers["n8n-mcp"].env), which is gitignored.
//   WORKFLOW_ID                ← env var, else the default below.
//   NGROK_API                  ← env var, else http://127.0.0.1:4040/api/tunnels.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const WORKFLOW_ID = process.env.WORKFLOW_ID || 'rQ7I7vX2oAYnNIbR';
const NGROK_API = process.env.NGROK_API || 'http://127.0.0.1:4040/api/tunnels';
// Matches the origin of any ngrok host (ngrok-free.app / ngrok.app / ngrok.io / ngrok.dev),
// leaving the path (e.g. /api/calendar/slots) untouched.
const NGROK_ORIGIN_RE = /https?:\/\/[^/"\s]*\bngrok(?:-free)?\.(?:app|io|dev)/gi;

// Throw instead of process.exit() — exiting mid-flight races undici's keep-alive
// sockets and trips a libuv assertion on Windows. main() catches and sets exitCode.
function die(msg) {
  throw new Error(msg);
}

// n8n's public-API PUT validates `settings` against a fixed schema and rejects
// any key outside this set. Keep only allowed keys so re-saving a workflow that
// carries internal-only props (binaryMode, availableInMCP, …) doesn't 400.
const ALLOWED_SETTINGS_KEYS = new Set([
  'executionOrder',
  'saveExecutionProgress',
  'saveManualExecutions',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'executionTimeout',
  'errorWorkflow',
  'timezone',
  'callerPolicy',
  'callerIds',
]);

function sanitizeSettings(settings) {
  const out = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (ALLOWED_SETTINGS_KEYS.has(k)) out[k] = v;
  }
  return out;
}

// ── Resolve n8n API credentials (env → .mcp.json) ───────────────────────────
function resolveN8nConfig() {
  let url = process.env.N8N_API_URL;
  let key = process.env.N8N_API_KEY;
  if (url && key) return { url, key };
  try {
    const mcp = JSON.parse(readFileSync(resolve(__dirname, '..', '.mcp.json'), 'utf8'));
    const env = mcp?.mcpServers?.['n8n-mcp']?.env ?? {};
    url ||= env.N8N_API_URL;
    key ||= env.N8N_API_KEY;
  } catch {
    /* .mcp.json absent — fall through to the check below */
  }
  if (!url || !key) {
    die('N8N_API_URL / N8N_API_KEY not found in env or ../.mcp.json');
  }
  return { url: url.replace(/\/$/, ''), key };
}

// ── Find the live ngrok https URL forwarding to :3000 ───────────────────────
async function resolveNgrokUrl() {
  if (process.env.NGROK_URL) return process.env.NGROK_URL.replace(/\/$/, '');
  let data;
  try {
    const res = await fetch(NGROK_API, { headers: { Connection: 'close' } });
    if (!res.ok) die(`ngrok API ${NGROK_API} returned HTTP ${res.status}`);
    data = await res.json();
  } catch {
    die(`Cannot reach ngrok at ${NGROK_API} — is ngrok running? (ngrok http 127.0.0.1:3000)`);
  }
  const tunnels = data.tunnels ?? [];
  const https = tunnels.filter((t) => t.public_url?.startsWith('https://'));
  if (https.length === 0) die('ngrok is running but exposes no https tunnel');
  // Prefer the tunnel forwarding to :3000; else the first https tunnel.
  const pick = https.find((t) => /:3000$/.test(t.config?.addr ?? '')) ?? https[0];
  return pick.public_url.replace(/\/$/, '');
}

// ── n8n REST helpers ────────────────────────────────────────────────────────
async function n8n(method, path, key, baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', Connection: 'close' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    die(`n8n ${method} ${path} → HTTP ${res.status} ${text}`);
  }
  return res.json();
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { url: N8N_URL, key: N8N_KEY } = resolveN8nConfig();
  const ngrokUrl = await resolveNgrokUrl();
  console.log(`• Live ngrok URL : ${ngrokUrl}`);
  console.log(`• n8n instance   : ${N8N_URL}`);
  console.log(`• Workflow       : ${WORKFLOW_ID}`);

  const wf = await n8n('GET', `/workflows/${WORKFLOW_ID}`, N8N_KEY, N8N_URL);

  const changed = [];
  for (const node of wf.nodes ?? []) {
    const u = node.parameters?.url;
    if (typeof u !== 'string' || !NGROK_ORIGIN_RE.test(u)) continue;
    const next = u.replace(NGROK_ORIGIN_RE, ngrokUrl);
    if (next !== u) {
      changed.push({ node: node.name, from: u, to: next });
      node.parameters.url = next;
    }
  }

  if (changed.length === 0) {
    console.log('✓ Nothing to patch — all node URLs already point at the live tunnel.');
    return;
  }

  console.log(`\n${DRY_RUN ? 'Would patch' : 'Patching'} ${changed.length} node(s):`);
  for (const c of changed) console.log(`  - ${c.node}\n      ${c.from}\n   →  ${c.to}`);

  if (DRY_RUN) {
    console.log('\n(dry run — no changes written)');
    return;
  }

  // n8n public API PUT accepts only name / nodes / connections / settings, and
  // its `settings` schema rejects unknown keys ("settings must NOT have additional
  // properties"). The GET returns internal-only props (e.g. binaryMode,
  // availableInMCP) that the PUT schema doesn't allow, so whitelist before sending.
  await n8n('PUT', `/workflows/${WORKFLOW_ID}`, N8N_KEY, N8N_URL, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: sanitizeSettings(wf.settings),
  });

  console.log(`\n✓ Patched ${changed.length} node(s) and saved the workflow.`);
  console.log('  Smoke-test:');
  const webhookBase = N8N_URL.includes('appointer') ? 'https://n8ndev.appointer.hu' : N8N_URL;
  console.log(`  curl -s -X POST ${webhookBase}/webhook/retell-custom-functions \\`);
  console.log(
    `    -H "Content-Type: application/json" \\\n    -d '{"name":"check_availability","args":{"date":"2026-06-15","appointment_type":"new_patient_exam"},"call":{"call_id":"smoke"}}'`,
  );
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
});
