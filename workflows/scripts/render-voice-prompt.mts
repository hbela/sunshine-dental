/**
 * Render a clinic's Retell voice-agent system prompt.
 *
 *   pnpm prompt:voice -- --clinic corona            # print to stdout
 *   pnpm prompt:voice -- --clinic corona --out p.md # write to a file
 *
 * The prompt is generated from `ClinicConfig` plus the shared prompt modules in
 * `apps/api/src/prompts/`, so it agrees with the chat receptionist by
 * construction. This replaces the string substitution `retell-clone-agent.mts`
 * used to do, which could only ever get a prompt ~90% of the way there.
 *
 * It does NOT push anything to Retell. Review the output, diff it against the
 * live agent (which has been hand-tuned — see docs/retell-hu-prompt-new-*.txt),
 * fold anything missing back into the prompt modules, and only then publish.
 */
import { writeFileSync } from 'node:fs';
// Relative imports on purpose: `@repo/shared` is a dependency of apps/*, not of
// the workspace root, so a bare specifier does not resolve here. Same reason
// `retell-clone-agent.mts` and `apps/web/vite.config.ts` do this.
import { getClinic, listClinicIds } from '../../packages/shared/src/clinic.js';
import { buildVoiceSystemPrompt } from '../../apps/api/src/prompts/voice-agent.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const clinicId = arg('clinic');
if (!clinicId) {
  console.error(
    `Usage: pnpm prompt:voice -- --clinic <id> [--out <file>]\n` +
      `Known clinics: ${listClinicIds().join(', ')}`,
  );
  process.exit(1);
}

// getClinic throws on an unknown id or a malformed service list.
const prompt = buildVoiceSystemPrompt(getClinic(clinicId));

const out = arg('out');
if (out) {
  writeFileSync(out, prompt, 'utf8');
  console.error(`Wrote ${prompt.length} chars to ${out}`);
} else {
  process.stdout.write(prompt);
}
