import { FastifyRequest, FastifyReply } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { auth } from '../lib/auth.js';

// Fail-closed, timing-safe API-key check. An unset/empty FASTIFY_API_KEY must
// never authenticate — plain `key === process.env.X` passes when both sides
// are undefined/empty. Boot-time validation (lib/env.ts) is the primary guard;
// this is defense in depth.
export function isValidApiKey(key: string | undefined): boolean {
  const expected = process.env.FASTIFY_API_KEY;
  if (!expected || !key) return false;
  const received = Buffer.from(key);
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: request.headers as unknown as Headers });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  // @ts-ignore
  request.user = session.user;
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // @ts-ignore
    const user = request.user;
    if (!user || (!roles.includes(user.role) && user.role !== 'ADMIN')) {
      return reply.status(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
  };
}

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers.authorization?.replace('Bearer ', '');
  if (!isValidApiKey(key)) {
    return reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
  }
}

export async function requireAuthOrApiKey(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers.authorization?.replace('Bearer ', '');
  if (isValidApiKey(key)) {
    return; // API Key is valid
  }
  
  const session = await auth.api.getSession({ headers: request.headers as unknown as Headers });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  // @ts-ignore
  request.user = session.user;
}
