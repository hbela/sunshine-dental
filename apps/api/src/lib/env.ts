import { z } from 'zod';

// Boot-time environment validation. Missing/weak values in these variables
// previously caused silent security failures (e.g. an unset FASTIFY_API_KEY
// made every API-key check pass). Fail loudly at startup instead.
// Only imported from server.ts — never from modules used by unit tests.
const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)'),
    FASTIFY_API_KEY: z
      .string()
      .min(16, 'FASTIFY_API_KEY must be at least 16 characters (openssl rand -hex 16)'),
    N8N_BOOKING_WEBHOOK_URL: z.string().optional(),
    N8N_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.N8N_BOOKING_WEBHOOK_URL && (!env.N8N_WEBHOOK_SECRET || env.N8N_WEBHOOK_SECRET.length < 16)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'N8N_WEBHOOK_SECRET must be at least 16 characters when N8N_BOOKING_WEBHOOK_URL is set (openssl rand -hex 16)',
      });
    }
  });

export function validateEnv(): void {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.message}`)
      .join('\n');
    console.error(`FATAL: invalid environment, refusing to start:\n${problems}`);
    process.exit(1);
  }
}
