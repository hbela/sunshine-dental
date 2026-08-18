import { describe, it, expect } from 'vitest';
import { getClinic, listClinicIds } from '@repo/shared';
import { buildChatSystemPrompt } from './chat-receptionist.js';

/**
 * The chat prompt is generated per clinic from `scheduling-core.ts` + the domain
 * pack, so a new clinic's prompt is correct by construction rather than
 * hand-edited.
 *
 * These assertions were written when the prompt was hand-maintained and drifted
 * from the clinic config — it was still telling Hungarian patients to dial 911,
 * and named services the clinic did not offer. They stay because those are
 * properties of the prompt, not of the old drift: the committed snapshot means
 * any future wording change has to be deliberate.
 */

const CLINIC_IDS = listClinicIds();

describe.each(CLINIC_IDS)('%s chat prompt', (id) => {
  const clinic = getClinic(id);
  const chat = buildChatSystemPrompt('2026-07-26', clinic);

  it('never names another clinic', () => {
    for (const other of CLINIC_IDS.filter((x) => x !== id)) {
      expect(chat).not.toContain(getClinic(other).name);
    }
  });

  it('gives the clinic\'s own emergency number and never a foreign one', () => {
    expect(chat).toContain(clinic.emergencyNumber);
    expect(chat).not.toMatch(/\b911\b/);
  });

  it('lists exactly the services the clinic offers, with their durations', () => {
    for (const service of clinic.services) {
      expect(chat).toContain(`- ${service.labels.en} (${service.durationMinutes} min) — ${service.code.toLowerCase()}`);
    }
  });

  it('offers no service the clinic does not have', () => {
    const listed = chat.split('## Appointment types (and duration)')[1]!.split('\n\n')[0]!;
    const codes = [...listed.matchAll(/— ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(codes.sort()).toEqual(clinic.services.map((s) => s.code.toLowerCase()).sort());
  });

  it('uses the approved Hungarian name for every service', () => {
    if (!clinic.languages.includes('hu')) return;
    for (const service of clinic.services) {
      if (!service.labels.hu) continue;
      expect(chat).toContain(`${service.labels.en} → **${service.labels.hu}**`);
    }
  });

  it('carries the Hungarian register rules', () => {
    if (!clinic.languages.includes('hu')) return;
    for (const rule of ['NEVER use the word "fogász"', 'never "takarítás"', 'TAJ kártya']) {
      expect(chat).toContain(rule);
    }
  });

  it('only advertises the languages the clinic actually serves', () => {
    const absent = (['en', 'hu', 'de'] as const).filter((l) => !clinic.languages.includes(l));
    for (const lang of absent) {
      const name = { en: 'English', hu: 'Hungarian', de: 'German' }[lang];
      expect(chat).not.toContain(`${name}-speaking`);
    }
  });

  it('matches the committed snapshot', () => {
    expect(chat).toMatchSnapshot('chat');
  });
});
