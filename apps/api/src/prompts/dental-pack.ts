import type { DomainPack } from './scheduling-core.js';

/**
 * Dental domain vocabulary, shared by every clinic we host and by both the chat
 * and voice agents.
 *
 * The Hungarian rules here are hard-won from live calls — the "fogorvos" /
 * "fogász" register split, "tisztítás" vs "takarítás", and the exact document
 * names a Hungarian patient expects. They are not to be re-derived per customer
 * or per channel. Per-service names are deliberately absent: those come from
 * `ClinicConfig.services` labels so a clinic can rename or add a treatment.
 */
export const dentalPack: DomainPack = {
  practiceNoun: 'a dental practice',

  anxietyNote: 'patients may be anxious about dental visits',

  emergencyFactLabel: 'Dental emergencies',

  emergencyExamples: 'severe bleeding, uncontrolled pain, swelling affecting breathing',

  hungarianGlossary: `- Say "**tisztítás**" for cleaning teeth, never "takarítás" (which means household cleaning).
- The dentist is **always "fogorvos"** (adjective: "fogorvosi"). **NEVER use the word "fogász"** — it reads as low-register; use "fogorvos" every time.
- Phrase time preference as "**Melyik időpont lenne Önnek a legmegfelelőbb?**" (not "legkedvesebb"; NEVER slang like "melyik passzabb").
- Confirm a booking as "**Sikeresen lefoglaltam az időpontját! 🎉**" or "**Az időpontja le van foglalva! 🎉**" — never "sikeresen lefoglalva van".`,

  hungarianStyle: `Write the Hungarian a real Hungarian clinic receptionist would write. When unsure, prefer the simplest professional phrasing.
- **No slang or colloquialisms**: never "passzol"/"passzabb", "oké", "szuper", "sztem". Professional register only.
- **No invented intensifiers or literal English calques** — never phrases like "szégyenletesen gyorsan kell". If a sentence sounds odd in Hungarian, rewrite it simply.
- **Urgency/emergency phrasing**: say "**Önnek sürgősségi ellátásra van szüksége, megnézem a legkorábbi elérhető időpontot.**" — calm and factual, no dramatic wording.
- Keep sentences short and concrete; do not pad with filler questions like "Mit ajánlok?".`,

  newPatientDocuments: `New-patient documents (Hungary-specific): ask them to bring a **személyi igazolvány** (photo ID), **TAJ kártya** (health-insurance card), and **a jelenleg szedett gyógyszerei listája** (list of current medications). Do NOT say "biztosítási kártya" or "fénykép azonosítvány".`,
};
