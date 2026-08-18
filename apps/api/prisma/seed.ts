import { PrismaClient } from '../src/generated/prisma-client/index.js';
import { auth } from '../src/lib/auth.js';
import { canonicalName } from '../src/lib/name.js';
import { unlockWithKeyCheck } from '../src/lib/crypto.js';
import { encryptRow, phoneIndexOf } from '../src/lib/crypto-fields.js';
import { clinic } from '../src/lib/clinic.js';

const prisma = new PrismaClient();

/**
 * `--minimal` seeds a REAL clinic: the staff accounts and standard availability
 * from its config (`packages/shared/src/clinics/<id>.ts`) and nothing else.
 * Without it the script seeds the original demo dataset — fake patients,
 * appointments and call logs — which must never land in a live clinic's
 * database. See docs/onboarding-new-clinic.md.
 */
const MINIMAL = process.argv.includes('--minimal') || process.env.SEED_MINIMAL === '1';

/** Initial password for every seeded account; override with SEED_PASSWORD. */
const DEFAULT_PASSWORDS: Record<string, string> = {
  ADMIN: 'Admin1234!',
  PROVIDER: 'Provider1234!',
  ASSISTANT: 'Assistant1234!',
};
const passwordFor = (role: string) => process.env.SEED_PASSWORD || DEFAULT_PASSWORDS[role] || 'Change1234!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Refuse to seed a non-local database unless explicitly forced. This script
 * WIPES every table and REWRITES the encryption canary from ENCRYPTION_KEY, so
 * running it against prod re-keys the DB (a wrong env key strands existing
 * ciphertext). An unparseable URL is treated as non-local (fail closed).
 * Override for a deliberate prod reset with `--force` or `SEED_ALLOW_PROD=1`.
 */
function assertSafeToSeed() {
  const url = process.env.DATABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  const isLocal = new Set(['localhost', '127.0.0.1', '::1', '[::1]']).has(host);
  const forced = process.argv.includes('--force') || process.env.SEED_ALLOW_PROD === '1';

  if (isLocal) return;
  if (forced) {
    console.warn(`⚠️  Seeding a NON-LOCAL database (host "${host || 'unparseable DATABASE_URL'}") — proceeding because an override is set.`);
    return;
  }
  console.error(
    `❌ Refusing to seed: DATABASE_URL host "${host || '(unparseable)'}" is not local.\n` +
    `   seed.ts WIPES all data and REWRITES the encryption canary from ENCRYPTION_KEY —\n` +
    `   running it against prod re-keys the database and can strand encrypted data.\n` +
    `   If this is intentional (e.g. a deliberate reset), re-run with --force or SEED_ALLOW_PROD=1.`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Minimal (real-clinic) seed
// ---------------------------------------------------------------------------

/**
 * Create the clinic's staff accounts and their standard weekly availability
 * from the clinic config — no demo patients, appointments or call logs.
 *
 * Assumes the caller has already wiped the database and armed the keyring, so
 * it shares the encryption guarantees of the demo path.
 */
async function seedMinimal() {
  console.log(`  ℹ Minimal seed for clinic "${clinic.id}" (${clinic.fullName})`);

  const created: Array<{ email: string; role: string; password: string; user: any }> = [];

  for (const member of clinic.seed.staff) {
    const password = passwordFor(member.role);
    const signUp = await auth.api.signUpEmail({
      body: { name: canonicalName(member), email: member.email, password },
    });
    const user = await prisma.user.update({
      where: { id: signUp.user.id },
      data: {
        role: member.role as any,
        emailVerified: true,
        title: member.title ?? null,
        givenName: member.givenName,
        familyName: member.familyName,
      },
    });
    created.push({ email: member.email, role: member.role, password, user });
  }
  console.log(`  ✓ Created ${created.length} users`);

  // Provider profiles + availability. Times in the config are HH:MM and are
  // written as UTC instants, matching how the demo seed and the calendar
  // service have always stored CalendarEvent rows.
  const { weekdays, horizonDays, blocks } = clinic.seed.availability;
  let providerCount = 0;
  let eventCount = 0;

  for (const member of clinic.seed.staff) {
    if (member.role !== 'PROVIDER') continue;
    const owner = created.find((c) => c.email === member.email)!.user;

    const provider = await prisma.provider.create({
      data: encryptRow('provider', {
        userId: owner.id,
        specialty: member.specialty ?? null,
        phone: member.phone ?? null,
        bio: member.bio ?? null,
        isActive: true,
      }),
    });
    providerCount++;

    const days = member.weekdays ?? weekdays;
    const events: any[] = [];
    let offset = 1;
    let added = 0;
    while (added < horizonDays) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // JS Sun=0 → ISO Sun=7
      if (days.includes(iso)) {
        const ds = d.toISOString().split('T')[0];
        for (const b of blocks) {
          events.push({
            providerId: provider.id,
            title: b.title,
            start: new Date(`${ds}T${b.start}:00.000Z`),
            end: new Date(`${ds}T${b.end}:00.000Z`),
            allDay: false,
            type: b.type,
            notes: b.notes ?? null,
            createdBy: owner.id,
          });
        }
        added++;
      }
      offset++;
      if (offset > 400) break; // guard against an empty `weekdays` config
    }
    await prisma.calendarEvent.createMany({ data: events });
    eventCount += events.length;
  }
  console.log(`  ✓ Created ${providerCount} provider profiles and ${eventCount} calendar events`);

  console.log('\n✅ Seed complete!\n');
  console.log('  Credentials — change these immediately after the first login:');
  for (const c of created) {
    console.log(`  │ ${c.email.padEnd(34)} │ ${c.password.padEnd(17)} │ ${c.role}`);
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding database...');

  // ── Safety gate: never silently wipe/re-key a non-local (prod) DB ──────────
  assertSafeToSeed();

  // ── 0. Encryption key (PII is encrypted at rest) ──────────────────────────
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    console.error('❌ Set ENCRYPTION_KEY in apps/api/.env (generate: openssl rand -hex 32) — patient PII is encrypted at rest.');
    process.exit(1);
  }

  // ── 1. Wipe existing data ─────────────────────────────────────────────────
  await prisma.calendarDelegation.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany(); // stale canary would reject the new key
  console.log('  ✓ Cleared existing data');

  // Arm the keyring + write a fresh key-check canary matching ENCRYPTION_KEY.
  await unlockWithKeyCheck(prisma, envKey);
  console.log('  ✓ Encryption keyring armed (canary written)');

  // A real clinic stops here: staff + availability only, no demo data.
  if (MINIMAL) return seedMinimal();

  // ── 2. Users & hashed passwords ───────────────────────────────────────────
  type SeedRole = 'ADMIN' | 'PROVIDER' | 'ASSISTANT';

  // Names use structured title/givenName/familyName. "Kis István" is Hungarian
  // family-first (family = Kis, given = István); the canonical `name` is Western
  // order but matching is order-independent.
  const usersData: Array<{ title?: string; givenName: string; familyName: string; email: string; password: string; role: SeedRole }> = [
    { title: 'Dr.', givenName: 'Admin',  familyName: '',        email: 'admin@sunshine.dental', password: 'Admin1234!',     role: 'ADMIN'     },
    { title: 'Dr.', givenName: 'Ibolya', familyName: 'Nagy',    email: 'alice@sunshine.dental', password: 'Provider1234!',  role: 'PROVIDER'  },
    { title: 'Dr.', givenName: 'István', familyName: 'Kis',     email: 'bob@sunshine.dental',   password: 'Provider1234!',  role: 'PROVIDER'  },
    {                givenName: 'Sara',   familyName: 'Johnson', email: 'sara@sunshine.dental',  password: 'Assistant1234!', role: 'ASSISTANT' },
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersData) {
    // Create the user + credential account through better-auth so the password
    // is hashed with better-auth's own algorithm (manual bcrypt is incompatible).
    const signUp = await auth.api.signUpEmail({
      body: { name: canonicalName(u), email: u.email, password: u.password },
    });

    const user = await prisma.user.update({
      where: { id: signUp.user.id },
      data: {
        role: u.role as any,
        emailVerified: true,
        title: u.title ?? null,
        givenName: u.givenName,
        familyName: u.familyName,
      },
    });

    createdUsers[u.email] = user;
  }

  console.log('  ✓ Created 4 users (admin, 2 providers, 1 assistant)');

  const adminUser  = createdUsers['admin@sunshine.dental'];
  const aliceUser  = createdUsers['alice@sunshine.dental'];
  const bobUser    = createdUsers['bob@sunshine.dental'];
  const saraUser   = createdUsers['sara@sunshine.dental'];

  // ── 3. Provider profiles ──────────────────────────────────────────────────
  const aliceProvider = await prisma.provider.create({
    data: encryptRow('provider', {
      userId: aliceUser.id,
      specialty: 'General Dentistry',
      phone: '+1-555-0101',
      bio: 'Experienced general dentist with 10+ years in family dental care.',
      isActive: true,
    }),
  });

  const bobProvider = await prisma.provider.create({
    data: encryptRow('provider', {
      userId: bobUser.id,
      specialty: 'Orthodontics',
      phone: '+1-555-0102',
      bio: 'Specialist in orthodontics and cosmetic dentistry.',
      isActive: true,
    }),
  });

  console.log('  ✓ Created provider profiles');

  // ── 4. Patients ───────────────────────────────────────────────────────────
  // PII goes through encryptRow; appointment rows below copy the returned
  // ciphertext values directly (same key, decrypts identically).
  const patients = await Promise.all([
    prisma.patient.create({
      data: encryptRow('patient', {
        name: 'John Smith',
        phone: '+1-555-1001',
        phoneIndex: phoneIndexOf('+1-555-1001'),
        email: 'john.smith@email.com',
        reason: 'Routine cleaning',
        isNewPatient: false,
        callbackRequested: false,
        preferredTime: 'morning',
      }),
    }),
    prisma.patient.create({
      data: encryptRow('patient', {
        name: 'Emily Chen',
        phone: '+1-555-1002',
        phoneIndex: phoneIndexOf('+1-555-1002'),
        email: 'emily.chen@email.com',
        reason: 'Tooth pain — lower right molar',
        isNewPatient: true,
        callbackRequested: true,
        preferredTime: 'afternoon',
        notes: 'Has dental anxiety, prefers slow approach',
      }),
    }),
    prisma.patient.create({
      data: encryptRow('patient', {
        name: 'Marcus Williams',
        phone: '+1-555-1003',
        phoneIndex: phoneIndexOf('+1-555-1003'),
        email: 'marcus.w@email.com',
        reason: 'Filling replacement',
        isNewPatient: false,
        callbackRequested: false,
        preferredTime: 'evening',
      }),
    }),
  ]);

  console.log('  ✓ Created 3 patients');

  // ── 5. Calendar Delegation ────────────────────────────────────────────────
  await prisma.calendarDelegation.create({
    data: {
      ownerId: aliceProvider.id,
      delegateId: saraUser.id,
      canView: true,
      canEdit: true,
      canBook: true,
    },
  });

  console.log("  ✓ Sara delegated to manage Alice's calendar");

  // ── 6. Calendar Events ────────────────────────────────────────────────────
  // Alice: Mon–Fri 09-13 (AVAILABLE), 13-14 (BLOCKED/lunch), 14-17 (AVAILABLE) for 10 weekdays
  const aliceEvents: any[] = [];
  let dayOffset = 1;
  let weekdaysAdded = 0;

  while (weekdaysAdded < 10) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const dow = d.getUTCDay(); // 0=Sun 6=Sat
    if (dow !== 0 && dow !== 6) {
      const ds = d.toISOString().split('T')[0];
      aliceEvents.push(
        { providerId: aliceProvider.id, title: 'Morning Availability', start: new Date(`${ds}T09:00:00.000Z`), end: new Date(`${ds}T13:00:00.000Z`), allDay: false, type: 'AVAILABLE', createdBy: aliceUser.id },
        { providerId: aliceProvider.id, title: 'Lunch Break',          start: new Date(`${ds}T13:00:00.000Z`), end: new Date(`${ds}T14:00:00.000Z`), allDay: false, type: 'BLOCKED',   notes: 'Lunch', createdBy: aliceUser.id },
        { providerId: aliceProvider.id, title: 'Afternoon Availability', start: new Date(`${ds}T14:00:00.000Z`), end: new Date(`${ds}T17:00:00.000Z`), allDay: false, type: 'AVAILABLE', createdBy: aliceUser.id },
      );
      weekdaysAdded++;
    }
    dayOffset++;
  }

  await prisma.calendarEvent.createMany({ data: aliceEvents });

  // Bob: Tue + Thu only, 08-12 and 13-16, plus vacation next Friday
  const bobEvents: any[] = [];
  dayOffset = 1;
  weekdaysAdded = 0;

  while (weekdaysAdded < 6) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const dow = d.getUTCDay();
    if (dow === 2 || dow === 4) { // Tue or Thu
      const ds = d.toISOString().split('T')[0];
      bobEvents.push(
        { providerId: bobProvider.id, title: 'Morning Availability',   start: new Date(`${ds}T08:00:00.000Z`), end: new Date(`${ds}T12:00:00.000Z`), allDay: false, type: 'AVAILABLE', createdBy: bobUser.id },
        { providerId: bobProvider.id, title: 'Afternoon Availability', start: new Date(`${ds}T13:00:00.000Z`), end: new Date(`${ds}T16:00:00.000Z`), allDay: false, type: 'AVAILABLE', createdBy: bobUser.id },
      );
      weekdaysAdded++;
    }
    dayOffset++;
  }

  // Bob vacation — next Friday
  let fridayOffset = 1;
  while (true) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + fridayOffset);
    if (d.getUTCDay() === 5) break;
    fridayOffset++;
  }
  const vacDate = new Date();
  vacDate.setUTCDate(vacDate.getUTCDate() + fridayOffset);
  const vacDs = vacDate.toISOString().split('T')[0];
  bobEvents.push({ providerId: bobProvider.id, title: 'Vacation Day', start: new Date(`${vacDs}T00:00:00.000Z`), end: new Date(`${vacDs}T23:59:59.000Z`), allDay: true, type: 'VACATION', notes: 'Personal day off', createdBy: bobUser.id });

  await prisma.calendarEvent.createMany({ data: bobEvents });
  console.log('  ✓ Created calendar events (Alice: Mon–Fri × 10 days | Bob: Tue/Thu × 3 weeks + vacation)');

  // ── 7. Appointments ───────────────────────────────────────────────────────
  // Find the next N weekdays from today
  function nextWeekday(n: number) {
    const d = new Date();
    let added = 0;
    while (added < n) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++;
    }
    return new Date(d);
  }

  function t(base: Date, h: number, m: number) {
    const d = new Date(base);
    d.setUTCHours(h, m, 0, 0);
    return d;
  }

  const d1 = nextWeekday(1);
  const d2 = nextWeekday(2);
  const d3 = nextWeekday(3);

  await prisma.appointment.create({ data: encryptRow('appointment', { patientId: patients[0]!.id, patientName: patients[0]!.name, patientPhone: patients[0]!.phone, patientEmail: patients[0]!.email, providerId: aliceProvider.id, providerName: aliceUser.name, appointmentType: 'CLEANING',         date: d1, startTime: t(d1, 9,  0), endTime: t(d1, 9,  30), durationMinutes: 30, status: 'CONFIRMED', isNewPatient: false, notes: 'Regular biannual cleaning' }) });
  await prisma.appointment.create({ data: encryptRow('appointment', { patientId: patients[1]!.id, patientName: patients[1]!.name, patientPhone: patients[1]!.phone, patientEmail: patients[1]!.email, providerId: aliceProvider.id, providerName: aliceUser.name, appointmentType: 'NEW_PATIENT_EXAM', date: d1, startTime: t(d1, 10, 0), endTime: t(d1, 11,  0), durationMinutes: 60, status: 'CONFIRMED', isNewPatient: true,  notes: 'Tooth pain — lower right molar. Handle with care.' }) });
  await prisma.appointment.create({ data: encryptRow('appointment', { patientId: patients[2]!.id, patientName: patients[2]!.name, patientPhone: patients[2]!.phone, patientEmail: patients[2]!.email, providerId: aliceProvider.id, providerName: aliceUser.name, appointmentType: 'FILLING',          date: d2, startTime: t(d2, 9,  30), endTime: t(d2, 10, 15), durationMinutes: 45, status: 'CONFIRMED', isNewPatient: false, notes: 'Old filling — upper left second premolar.' }) });
  await prisma.appointment.create({ data: encryptRow('appointment', { patientId: patients[0]!.id, patientName: patients[0]!.name, patientPhone: patients[0]!.phone, patientEmail: patients[0]!.email, providerId: bobProvider.id,   providerName: bobUser.name,   appointmentType: 'CONSULTATION',    date: d3, startTime: t(d3, 8,   0), endTime: t(d3, 8,  30), durationMinutes: 30, status: 'CONFIRMED', isNewPatient: false, notes: 'Alignment consultation.' }) });
  console.log('  ✓ Created 4 appointments');

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('  Credentials:');
  console.log('  ┌────────────────────────────────┬───────────────────┬───────────┐');
  console.log('  │ Email                          │ Password          │ Role      │');
  console.log('  ├────────────────────────────────┼───────────────────┼───────────┤');
  console.log('  │ admin@sunshine.dental          │ Admin1234!        │ ADMIN     │');
  console.log('  │ alice@sunshine.dental          │ Provider1234!     │ PROVIDER  │');
  console.log('  │ bob@sunshine.dental            │ Provider1234!     │ PROVIDER  │');
  console.log('  │ sara@sunshine.dental           │ Assistant1234!    │ ASSISTANT │');
  console.log('  └────────────────────────────────┴───────────────────┴───────────┘');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
