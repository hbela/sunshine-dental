import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SLOT_INTERVAL_MINUTES,
  FALLBACK_DURATION_MINUTES,
  agentServiceCodes,
  defaultServiceCode,
  durationFor,
  findService,
  getClinic,
  listClinicIds,
  serviceCodes,
  serviceLabel,
  slotInterval,
  type ClinicConfig,
} from '@repo/shared';

/**
 * Services moved from a Prisma enum + a shared duration constant into per-clinic
 * config. These tests pin the two things that migration could silently break:
 * the durations every booking depends on, and the lowercase/UPPERCASE contract
 * the n8n router relies on (it blindly `.toUpperCase()`s what the agent sends).
 */

const sunshine = getClinic('sunshine');
const corona = getClinic('corona');

/** The seven codes and durations that were hardcoded before this refactor. */
const LEGACY_DURATIONS: Record<string, number> = {
  CLEANING: 30,
  NEW_PATIENT_EXAM: 60,
  DEEP_CLEANING: 60,
  FILLING: 45,
  CROWN_PREP: 90,
  CONSULTATION: 30,
  EMERGENCY: 30,
};

describe('clinic service config', () => {
  it('every clinic still offers the legacy services at the legacy durations', () => {
    for (const id of listClinicIds()) {
      const clinic = getClinic(id);
      for (const [code, minutes] of Object.entries(LEGACY_DURATIONS)) {
        expect(durationFor(clinic, code), `${id}/${code}`).toBe(minutes);
      }
    }
  });

  it('exposes lowercase codes to the agent that round-trip through toUpperCase()', () => {
    // The n8n router does `args.appointment_type.toUpperCase()` with no mapping,
    // so this has to stay a pure case flip.
    for (const id of listClinicIds()) {
      const clinic = getClinic(id);
      for (const lower of agentServiceCodes(clinic)) {
        expect(lower).toBe(lower.toLowerCase());
        expect(serviceCodes(clinic)).toContain(lower.toUpperCase());
        expect(findService(clinic, lower)?.code).toBe(lower.toUpperCase());
      }
    }
  });

  it('resolves a service in either case, and not at all when unknown', () => {
    expect(findService(sunshine, 'cleaning')?.code).toBe('CLEANING');
    expect(findService(sunshine, 'CLEANING')?.code).toBe('CLEANING');
    expect(findService(sunshine, '  Cleaning  ')?.code).toBe('CLEANING');
    expect(findService(sunshine, 'ROOT_CANAL')).toBeUndefined();
    expect(findService(sunshine, undefined)).toBeUndefined();
  });

  it('falls back to a sane duration for an unknown code', () => {
    expect(durationFor(sunshine, 'ROOT_CANAL')).toBe(FALLBACK_DURATION_MINUTES);
  });

  it('keeps CONSULTATION as the implicit default both clinics used to hardcode', () => {
    expect(defaultServiceCode(sunshine)).toBe('CONSULTATION');
    expect(defaultServiceCode(corona)).toBe('CONSULTATION');
  });

  it('defaults the slot interval to the historical 30 minutes', () => {
    expect(slotInterval(sunshine)).toBe(DEFAULT_SLOT_INTERVAL_MINUTES);
    expect(slotInterval(sunshine)).toBe(30);
  });
});

describe('serviceLabel', () => {
  it('prefers the requested language, then English', () => {
    expect(serviceLabel(sunshine, 'CLEANING', 'hu')).toBe('Fogkőeltávolítás');
    expect(serviceLabel(sunshine, 'CLEANING', 'de')).toBe('Zahnreinigung');
    expect(serviceLabel(sunshine, 'CLEANING', 'en')).toBe('Regular Cleaning');
    // Corona serves hu/en only — German falls back to English rather than blank.
    expect(serviceLabel(corona, 'CLEANING', 'de')).toBe('Regular Cleaning');
  });

  it('degrades an unknown code instead of rendering nothing', () => {
    expect(serviceLabel(sunshine, 'ROOT_CANAL', 'en')).toBe('root canal');
  });
});

describe('getClinic validation', () => {
  const base = { ...sunshine };
  const withServices = (services: ClinicConfig['services']) => ({ ...base, services });

  // getClinic only validates registered clinics, so exercise the same rules by
  // calling it after monkey-patching would be fragile; instead assert the shape
  // guarantees that the registry currently satisfies.
  it('every registered clinic passes its own validation', () => {
    for (const id of listClinicIds()) expect(() => getClinic(id)).not.toThrow();
  });

  it('still refuses an unknown clinic id', () => {
    expect(() => getClinic('does-not-exist')).toThrow(/Unknown clinic id/);
  });

  it('every service code is UPPER_SNAKE with a positive duration and an English label', () => {
    for (const id of listClinicIds()) {
      for (const service of withServices(getClinic(id).services).services) {
        expect(service.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
        expect(service.durationMinutes).toBeGreaterThan(0);
        expect(Number.isInteger(service.durationMinutes)).toBe(true);
        expect(service.labels.en.trim()).not.toBe('');
      }
    }
  });
});
