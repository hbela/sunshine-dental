/**
 * Per-clinic configuration — the single source of truth for everything that
 * differs between the clinics we host.
 *
 * The product is deployed **one isolated stack per clinic** (own domain, own
 * Postgres, own Retell agent — see `docs/onboarding-new-clinic.md`), all built
 * from the same `main` branch. The only thing that varies at build/boot time is
 * the clinic id:
 *
 *   • API  — `CLINIC_ID`      (runtime env, read in apps/api)
 *   • web  — `VITE_CLINIC_ID` (BUILD arg, baked into the bundle by Vite)
 *
 * Both default to `sunshine`, so an unconfigured stack behaves exactly as
 * before this config existed.
 *
 * Configs live in `./clinics/*.ts` (TypeScript, not JSON, so `satisfies
 * ClinicConfig` catches a missing FAQ topic or language at compile time rather
 * than as a blank answer on a live patient call).
 */

// ── Languages ───────────────────────────────────────────────────────────────

export const CLINIC_LANGUAGES = ['en', 'hu', 'de'] as const;
export type ClinicLanguage = (typeof CLINIC_LANGUAGES)[number];

export function isClinicLanguage(value: unknown): value is ClinicLanguage {
  return typeof value === 'string' && (CLINIC_LANGUAGES as readonly string[]).includes(value);
}

// ── FAQ ─────────────────────────────────────────────────────────────────────

/**
 * The topics the voice agent's `get_faq_answer` tool may ask for. Kept in sync
 * with the tool definition on the Retell agent — adding one here means adding
 * it to the tool's enum too, or the agent will never request it.
 */
export const FAQ_TOPICS = [
  'office_hours',
  'services',
  'insurance',
  'emergency',
  'cancellation_policy',
  'new_patient_info',
  'location',
  'payment_options',
] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

export function isFaqTopic(value: unknown): value is FaqTopic {
  return typeof value === 'string' && (FAQ_TOPICS as readonly string[]).includes(value);
}

/** Spoken when a caller asks about something the clinic hasn't given us facts for. */
export const FAQ_FALLBACK: Record<ClinicLanguage, string> = {
  en: "I'm sorry, I don't have information on that topic. Would you like me to have someone from the office call you back?",
  hu: 'Sajnálom, erről a témáról nincs információm. Szeretné, ha valaki a rendelőből visszahívná Önt?',
  de: 'Es tut mir leid, zu diesem Thema habe ich keine Informationen. Möchten Sie, dass Sie jemand aus der Praxis zurückruft?',
};

// ── Config shape ────────────────────────────────────────────────────────────

/** A staff member the first-install seed creates (intake form §4 and §5). */
export interface ClinicStaffMember {
  /** Honorific, e.g. "Dr." */
  title?: string;
  givenName: string;
  familyName: string;
  /** Becomes their dashboard login — must be a real mailbox. */
  email: string;
  role: 'ADMIN' | 'PROVIDER' | 'ASSISTANT';
  /** PROVIDER only — shown to patients and used by the agent. */
  specialty?: string;
  bio?: string;
  phone?: string;
  /** PROVIDER only — overrides `seed.availability.weekdays` for this doctor. */
  weekdays?: readonly number[];
}

/** One block of a provider's standard day, as seeded into `CalendarEvent`. */
export interface ClinicAvailabilityBlock {
  title: string;
  /** 24-hour `HH:MM`, interpreted in UTC (matches the existing seed's behaviour). */
  start: string;
  end: string;
  type: 'AVAILABLE' | 'BLOCKED';
  notes?: string;
}

export interface ClinicConfig {
  /** Slug used by `CLINIC_ID` / `VITE_CLINIC_ID`. Must equal the registry key. */
  id: string;
  /** Display name patients see, e.g. "Sunshine Dental". */
  name: string;
  /** Long form for page titles and the API docs, e.g. "Sunshine Dental Clinic". */
  fullName: string;
  /** ≤12 chars — the phone home-screen icon label. */
  shortName: string;
  /** What the AI receptionist calls itself. */
  personaName: string;

  /** IANA timezone; every date the agent reasons about is resolved in it. */
  timezone: string;
  /** Languages the agent and UI support, in priority order. */
  languages: readonly ClinicLanguage[];
  defaultLanguage: ClinicLanguage;

  contact: {
    /** Street + number, no postcode. */
    addressLine: string;
    postcode: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    website: string;
  };

  /** Local emergency-services number the agent gives for life-threatening cases. */
  emergencyNumber: string;

  brand: {
    themeColor: string;
    backgroundColor: string;
    /**
     * Where this clinic's favicon / apple-touch-icon / PWA icons live under
     * `apps/web/public`, with a trailing slash. Defaults to `/` (the original
     * Sunshine assets); a new clinic drops its set in
     * `apps/web/public/clinics/<id>/` and sets `/clinics/<id>/` here.
     */
    assetBasePath?: string;
  };

  /**
   * One-line English summary of opening hours, used inside the (English)
   * system prompts as scheduling guidance. Patient-facing hours come from
   * `faq.<lang>.office_hours`; real bookability always comes from the calendar.
   */
  officeHoursSummary: string;

  /**
   * Optional new-patient promotion the agent may mention **once** to a patient
   * who says they are new (e.g. a fixed-price starter package). Drives the
   * "New-patient package" chapter of the prompt; omit the whole field and the
   * chapter disappears. English is required (the prompt is English and the
   * agent translates); other languages optional.
   */
  promo?: { en: string } & Partial<Record<ClinicLanguage, string>>;

  /**
   * Patient-facing answers, per language. Both the chat and the voice FAQ read
   * these. English is mandatory (it is the fallback and the language the system
   * prompts are written in); other languages are optional so a clinic that only
   * serves en/hu doesn't have to invent German copy.
   */
  faq: { en: Record<FaqTopic, string> } & Partial<
    Record<ClinicLanguage, Record<FaqTopic, string>>
  >;

  /** First-install seed data (`pnpm exec tsx prisma/seed.ts --minimal`). */
  seed: {
    staff: readonly ClinicStaffMember[];
    availability: {
      /** ISO weekdays to seed: 1 = Monday … 7 = Sunday. */
      weekdays: readonly number[];
      /** How many matching days ahead to create availability for. */
      horizonDays: number;
      blocks: readonly ClinicAvailabilityBlock[];
    };
  };
}

// ── Registry ────────────────────────────────────────────────────────────────

import { sunshine } from './clinics/sunshine.js';
import { corona } from './clinics/corona.js';

export const DEFAULT_CLINIC_ID = 'sunshine';

const CLINICS: Record<string, ClinicConfig> = { sunshine, corona };

export function listClinicIds(): string[] {
  return Object.keys(CLINICS);
}

/**
 * Resolve a clinic config by id, falling back to {@link DEFAULT_CLINIC_ID} when
 * unset (an un-migrated stack keeps working).
 *
 * Throws on an id we don't know: a typo must fail loudly at boot, because
 * silently serving another clinic's address, hours and phone number to patients
 * is worse than not booting at all.
 */
export function getClinic(id?: string | null): ClinicConfig {
  const key = (id ?? '').trim() || DEFAULT_CLINIC_ID;
  const config = CLINICS[key];
  if (!config) {
    throw new Error(
      `Unknown clinic id "${key}". Known ids: ${listClinicIds().join(', ')}. ` +
        `Check CLINIC_ID / VITE_CLINIC_ID.`,
    );
  }
  return config;
}

/** FAQ answer with the documented fallbacks: requested language → English → generic apology. */
export function faqAnswer(clinic: ClinicConfig, topic: string, language: string): string {
  const lang = isClinicLanguage(language) ? language : 'en';
  if (!isFaqTopic(topic)) return FAQ_FALLBACK[lang];
  return clinic.faq[lang]?.[topic] || clinic.faq.en[topic] || FAQ_FALLBACK[lang];
}
