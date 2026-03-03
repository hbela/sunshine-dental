import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../lib/auth.js';

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
  if (key !== process.env.FASTIFY_API_KEY) {
    return reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
  }
}

export async function requireAuthOrApiKey(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers.authorization?.replace('Bearer ', '');
  if (key === process.env.FASTIFY_API_KEY) {
    return; // API Key is valid
  }
  
  const session = await auth.api.getSession({ headers: request.headers as unknown as Headers });
  if (!session) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  // @ts-ignore
  request.user = session.user;
}
