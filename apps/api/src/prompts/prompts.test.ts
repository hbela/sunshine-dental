import { describe, it, expect } from 'vitest';
import { getClinic, listClinicIds } from '@repo/shared';
import { buildChatSystemPrompt } from './chat-receptionist.js';
import { buildVoiceSystemPrompt } from './voice-agent.js';

/**
 * The chat and voice prompts are generated from the same modules so they cannot
 * drift the way the hand-maintained pair did — the voice prompt was still
 * telling Hungarian callers to dial 911, and the two disagreed on service names.
 *
 * These tests assert the properties that mattered when that drift bit, plus a
 * committed snapshot so any future wording change has to be deliberate.
 */

const CLINIC_IDS = listClinicIds();

describe.each(CLINIC_IDS)('%s prompts', (id) => {
  const clinic = getClinic(id);
  const chat = buildChatSystemPrompt('2026-07-26', clinic);
  const voice = buildVoiceSystemPrompt(clinic);

  it('never names another clinic', () => {
    for (const other of CLINIC_IDS.filter((x) => x !== id)) {
      const name = getClinic(other).name;
      expect(chat).not.toContain(name);
      expect(voice).not.toContain(name);
    }
  });

  it('gives the clinic\'s own emergency number and never a foreign one', () => {
    expect(chat).toContain(clinic.emergencyNumber);
    expect(voice).toContain(clinic.emergencyNumber);
    // The old hand-written voice prompt said "call 911" for a Budapest clinic.
    expect(voice).not.toMatch(/\b911\b/);
    expect(chat).not.toMatch(/\b911\b/);
  });

  it('lists exactly the services the clinic offers, with their durations', () => {
    for (const service of clinic.services) {
      expect(chat).toContain(`- ${service.labels.en} (${service.durationMinutes} min) — ${service.code.toLowerCase()}`);
      expect(voice).toContain(`- ${service.labels.en} (${service.durationMinutes} minutes)`);
    }
  });

  it('offers no service the clinic does not have', () => {
    const listed = chat.split('## Appointment types (and duration)')[1]!.split('\n\n')[0]!;
    const codes = [...listed.matchAll(/— ([a-z_]+)$/gm)].map((m) => m[1]);
    expect(codes.sort()).toEqual(clinic.services.map((s) => s.code.toLowerCase()).sort());
  });

  it('agrees with the voice prompt on Hungarian service names', () => {
    if (!clinic.languages.includes('hu')) return;
    for (const service of clinic.services) {
      if (!service.labels.hu) continue;
      const line = `${service.labels.en} → **${service.labels.hu}**`;
      expect(chat).toContain(line);
      expect(voice).toContain(line);
    }
  });

  it('carries the shared Hungarian register rules in both channels', () => {
    if (!clinic.languages.includes('hu')) return;
    for (const rule of ['NEVER use the word "fogász"', 'never "takarítás"', 'TAJ kártya']) {
      expect(chat).toContain(rule);
      expect(voice).toContain(rule);
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
    expect(voice).toMatchSnapshot('voice');
  });
});
