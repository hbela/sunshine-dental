/**
 * One-off migration: encrypt existing plaintext patient PII in place.
 *
 * Idempotent and crash-safe: only values WITHOUT the `enc:v1:` prefix are
 * touched, so the script can be re-run after a partial failure. Verifies (or
 * creates) the key-check canary BEFORE writing anything, so half the DB can
 * never end up encrypted under a second, different key.
 *
 * Run (locally or in the Coolify api container):
 *   pnpm exec tsx scripts/encrypt-existing-data.ts            # interactive key prompt
 *   pnpm exec tsx scripts/encrypt-existing-data.ts --key <64-hex>
 *   ENCRYPTION_MIGRATION_KEY=<64-hex> pnpm exec tsx scripts/encrypt-existing-data.ts
 */
import { createInterface } from 'node:readline';
import { PrismaClient } from '../src/generated/prisma-client/index.js';
import { isEncrypted, unlockWithKeyCheck } from '../src/lib/crypto.js';
import { ENCRYPTED_FIELDS, encryptRow, phoneIndexOf, type EncryptedModel } from '../src/lib/crypto-fields.js';

const BATCH_SIZE = 500;

const prisma = new PrismaClient();

async function resolveKey(): Promise<string> {
  const argIdx = process.argv.indexOf('--key');
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1]!;
  if (process.env.ENCRYPTION_MIGRATION_KEY) return process.env.ENCRYPTION_MIGRATION_KEY;

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const key = await new Promise<string>((resolve) => {
    rl.question('Master encryption key (64 hex chars): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
  return key;
}

interface ModelReport {
  scanned: number;
  encrypted: number;
  alreadyEncrypted: number;
  phoneIndexBackfilled: number;
}

/**
 * Page through a model by id, encrypting plaintext in-scope fields.
 * `delegate` is the loosely-typed Prisma model delegate (they all share the
 * findMany/update surface we use).
 */
async function migrateModel(model: EncryptedModel, delegate: any): Promise<ModelReport> {
  const report: ModelReport = { scanned: 0, encrypted: 0, alreadyEncrypted: 0, phoneIndexBackfilled: 0 };
  const fields = ENCRYPTED_FIELDS[model];
  let cursor: string | null = null;

  for (;;) {
    const rows: any[] = await delegate.findMany({
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const row of rows) {
      report.scanned++;
      const plainFields: Record<string, unknown> = {};
      let hasPlain = false;
      let hasCipher = false;
      for (const field of fields) {
        const value = row[field];
        if (typeof value !== 'string' || value === '') continue;
        if (isEncrypted(value)) {
          hasCipher = true;
        } else {
          plainFields[field] = value;
          hasPlain = true;
        }
      }

      const data: Record<string, unknown> = hasPlain ? encryptRow(model, plainFields) : {};

      // Backfill the phone blind index from the plaintext phone (only possible
      // while the phone is still plaintext — encrypted rows were written by
      // app code that set phoneIndex itself).
      if (model === 'patient' && !row.phoneIndex && typeof row.phone === 'string' && row.phone && !isEncrypted(row.phone)) {
        data.phoneIndex = phoneIndexOf(row.phone);
        report.phoneIndexBackfilled++;
      }

      if (Object.keys(data).length > 0) {
        updates.push({ id: row.id, data });
        report.encrypted++;
      } else if (hasCipher) {
        report.alreadyEncrypted++;
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates.map((u) => delegate.update({ where: { id: u.id }, data: u.data })));
    }
  }

  return report;
}

async function main() {
  const key = await resolveKey();

  // Canary gate: verifies against the stored key-check (or writes it on the
  // very first run) BEFORE any data is touched. A wrong key aborts here.
  const ok = await unlockWithKeyCheck(prisma, key);
  if (!ok) {
    console.error('❌ Key does not match the stored key-check canary — aborting, no data was modified.');
    process.exit(1);
  }
  console.log('✓ Key verified against canary\n');

  const targets: Array<[EncryptedModel, any]> = [
    ['patient', prisma.patient],
    ['appointment', prisma.appointment],
    ['callLog', prisma.callLog],
    ['chatMessage', prisma.chatMessage],
    ['chatConversation', prisma.chatConversation],
    ['provider', prisma.provider],
  ];

  let failed = false;
  for (const [model, delegate] of targets) {
    try {
      const r = await migrateModel(model, delegate);
      console.log(
        `${model.padEnd(18)} scanned=${r.scanned}  encrypted=${r.encrypted}  already-encrypted=${r.alreadyEncrypted}` +
          (model === 'patient' ? `  phoneIndex-backfilled=${r.phoneIndexBackfilled}` : ''),
      );
    } catch (err) {
      failed = true;
      console.error(`❌ ${model}: ${(err as Error).message}`);
    }
  }

  if (failed) {
    console.error('\n⚠ Some models failed — fix the cause and re-run (idempotent).');
    process.exit(1);
  }
  console.log('\n✅ Migration complete. Verify with a raw SELECT that PII columns show enc:v1: values.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
