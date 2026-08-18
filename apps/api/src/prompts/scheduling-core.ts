import type { ClinicConfig } from '@repo/shared';
import { serviceLabel } from '@repo/shared';

/**
 * Clinic-derived building blocks for the receptionist prompt: language lists,
 * the service menu, and the Hungarian service glossary.
 *
 * These were split out of the prompt text back when a voice agent and the chat
 * agent each had their own hand-written copy and the two drifted — the voice
 * one still told Hungarian callers to dial 911. The voice channel is gone, but
 * generating these from the clinic config is what keeps a newly onboarded
 * clinic's prompt from carrying another clinic's facts, so they stay here.
 */

/** Domain vocabulary and duty-of-care wording. One pack per kind of practice. */
export interface DomainPack {
  /** Noun phrase after the clinic name: "…, **a dental practice** in Budapest". */
  practiceNoun: string;
  /** Personality bullet explaining what these patients are anxious about. */
  anxietyNote: string;
  /** Heading for the urgent-care fact in the clinic-facts block. */
  emergencyFactLabel: string;
  /** Concrete symptoms that mean "stop booking and send them to emergency services". */
  emergencyExamples: string;
  /** Hungarian vocabulary rules that are *not* per-service — service names come from config. */
  hungarianGlossary: string;
  /** Hungarian register and naturalness rules. */
  hungarianStyle: string;
  /** What a first-time patient should bring. */
  newPatientDocuments: string;
}

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hu: 'Hungarian', de: 'German' };

/** "English", "Hungarian", "German" for the clinic's configured subset. */
export function languageNames(clinic: ClinicConfig): string[] {
  return clinic.languages.map((l) => LANGUAGE_NAMES[l] ?? l);
}

/** "English-, Hungarian-, and German-" — ready to be followed by "speaking patients". */
export function spokenList(clinic: ClinicConfig): string {
  const spoken = languageNames(clinic);
  if (spoken.length > 2) return `${spoken.slice(0, -1).join('-, ')}-, and ${spoken.at(-1)}-`;
  if (spoken.length === 2) return `${spoken[0]}- and ${spoken[1]}-`;
  return `${spoken[0]}-`;
}

/** "en (English), hu (Hungarian)" */
export function languageCodeList(clinic: ClinicConfig): string {
  return clinic.languages.map((l) => `${l} (${LANGUAGE_NAMES[l] ?? l})`).join(', ');
}

/**
 * The clinic's bookable services, one per line.
 *
 * Generated from `ClinicConfig.services` rather than typed into the prompt, so
 * adding a treatment is a config edit instead of a prompt edit in two places
 * plus a schema migration.
 */
export function serviceList(
  clinic: ClinicConfig,
  opts: { unit: 'min' | 'minutes'; withCode: boolean },
): string {
  return clinic.services
    .map((s) => {
      const code = opts.withCode ? ` — ${s.code.toLowerCase()}` : '';
      return `- ${s.labels.en} (${s.durationMinutes} ${opts.unit})${code}`;
    })
    .join('\n');
}

/**
 * Per-service Hungarian names for the terminology block, e.g.
 * `  - Regular Cleaning → **Fogkőeltávolítás**`.
 *
 * Empty when the clinic doesn't serve Hungarian, or when no service carries a
 * Hungarian label — an empty glossary beats a glossary of English words.
 */
export function hungarianServiceGlossary(clinic: ClinicConfig, indent = '  '): string {
  if (!clinic.languages.includes('hu')) return '';
  const lines = clinic.services
    .filter((s) => s.labels.hu)
    .map((s) => `${indent}- ${s.labels.en} → **${serviceLabel(clinic, s.code, 'hu')}**`);
  return lines.join('\n');
}
