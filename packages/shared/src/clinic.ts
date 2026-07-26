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

// ── Services ────────────────────────────────────────────────────────────────

/** Availability is walked in steps of this many minutes unless a clinic says otherwise. */
export const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

/** Appointment length assumed for a code the clinic doesn't list. */
export const FALLBACK_DURATION_MINUTES = 30;

/** Service codes are UPPER_SNAKE — the value stored in the DB and sent over HTTP. */
const SERVICE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * One bookable service. This replaced a Prisma enum + a shared duration
 * constant, so a clinic can offer whatever it actually offers, with its own
 * durations, without a schema change on every other clinic's stack.
 */
export interface ClinicService {
  /**
   * Canonical UPPER_SNAKE code — the DB value and the HTTP value.
   *
   * The voice and chat tools expose `code.toLowerCase()` and the n8n router
   * upper-cases it straight back, so the two must stay a pure case flip.
   */
  code: string;
  /** How long the appointment blocks the provider's calendar. */
  durationMinutes: number;
  /**
   * What patients are told this is called. English is required — the system
   * prompts are written in English and it is the fallback for every other
   * language.
   */
  labels: { en: string } & Partial<Record<ClinicLanguage, string>>;
}

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

  /**
   * Everything this clinic can be booked for, in the order patients should be
   * offered them. Drives the booking dropdown, the agent tool enums, the
   * prompt's service list and every duration lookup.
   */
  services: readonly ClinicService[];
  /**
   * Service assumed when the agent checks availability without naming one
   * (e.g. "who's free on Tuesday?"). Defaults to the first entry, so set it
   * only when the first service is a poor stand-in for a generic visit.
   */
  defaultServiceCode?: string;
  /**
   * Granularity of the offered start times, in minutes. Defaults to
   * {@link DEFAULT_SLOT_INTERVAL_MINUTES}. Lower it to pack the day more
   * tightly (a 45-minute service on a 30-minute stride can only ever start
   * on the hour or half hour).
   */
  slotIntervalMinutes?: number;

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
  assertValidServices(config);
  return config;
}

/**
 * Fail at boot on a malformed service list, for the same reason `getClinic`
 * throws on an unknown id: a typo here silently mis-prices a patient's time or
 * makes a service unbookable, which is worse than not starting.
 */
function assertValidServices(clinic: ClinicConfig): void {
  const where = `Clinic "${clinic.id}"`;
  if (!clinic.services?.length) {
    throw new Error(`${where} lists no services — at least one is required.`);
  }

  const seen = new Set<string>();
  for (const service of clinic.services) {
    if (!SERVICE_CODE_PATTERN.test(service.code)) {
      throw new Error(
        `${where}: service code "${service.code}" must be UPPER_SNAKE_CASE ` +
          `(the agent tools expose its lowercase form and n8n upper-cases it back).`,
      );
    }
    if (seen.has(service.code)) {
      throw new Error(`${where}: duplicate service code "${service.code}".`);
    }
    seen.add(service.code);

    if (!Number.isInteger(service.durationMinutes) || service.durationMinutes <= 0) {
      throw new Error(
        `${where}: service "${service.code}" needs a positive whole-minute duration, ` +
          `got ${service.durationMinutes}.`,
      );
    }
    if (!service.labels?.en?.trim()) {
      throw new Error(`${where}: service "${service.code}" is missing its English label.`);
    }
  }

  if (clinic.defaultServiceCode && !seen.has(clinic.defaultServiceCode)) {
    throw new Error(
      `${where}: defaultServiceCode "${clinic.defaultServiceCode}" is not one of its services ` +
        `(${[...seen].join(', ')}).`,
    );
  }

  const interval = clinic.slotIntervalMinutes;
  if (interval !== undefined && (!Number.isInteger(interval) || interval <= 0)) {
    throw new Error(`${where}: slotIntervalMinutes must be a positive whole number, got ${interval}.`);
  }
}

// ── Service lookups ─────────────────────────────────────────────────────────

/** Canonical UPPER_SNAKE codes, in the clinic's declared order. */
export function serviceCodes(clinic: ClinicConfig): string[] {
  return clinic.services.map((s) => s.code);
}

/** The lowercase codes the voice and chat tools expose to the model. */
export function agentServiceCodes(clinic: ClinicConfig): string[] {
  return clinic.services.map((s) => s.code.toLowerCase());
}

/** Resolve a service by code, accepting either case (the agent sends lowercase). */
export function findService(
  clinic: ClinicConfig,
  code?: string | null,
): ClinicService | undefined {
  if (!code) return undefined;
  const wanted = String(code).trim().toUpperCase();
  return clinic.services.find((s) => s.code === wanted);
}

/** Appointment length for a code, falling back to {@link FALLBACK_DURATION_MINUTES}. */
export function durationFor(clinic: ClinicConfig, code?: string | null): number {
  return findService(clinic, code)?.durationMinutes ?? FALLBACK_DURATION_MINUTES;
}

/** Patient-facing name, with the documented fallbacks: language → English → the bare code. */
export function serviceLabel(
  clinic: ClinicConfig,
  code?: string | null,
  language?: string,
): string {
  const service = findService(clinic, code);
  if (!service) return String(code ?? '').replace(/_/g, ' ').toLowerCase();
  const lang = isClinicLanguage(language) ? language : 'en';
  return service.labels[lang] || service.labels.en;
}

/** The service to assume when the caller didn't name one. */
export function defaultServiceCode(clinic: ClinicConfig): string {
  return clinic.defaultServiceCode ?? clinic.services[0]!.code;
}

/** Minutes between consecutive offered start times. */
export function slotInterval(clinic: ClinicConfig): number {
  return clinic.slotIntervalMinutes ?? DEFAULT_SLOT_INTERVAL_MINUTES;
}

/** FAQ answer with the documented fallbacks: requested language → English → generic apology. */
export function faqAnswer(clinic: ClinicConfig, topic: string, language: string): string {
  const lang = isClinicLanguage(language) ? language : 'en';
  if (!isFaqTopic(topic)) return FAQ_FALLBACK[lang];
  return clinic.faq[lang]?.[topic] || clinic.faq.en[topic] || FAQ_FALLBACK[lang];
}
