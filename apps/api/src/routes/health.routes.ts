import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { isUnlocked, getStoredKeyFingerprint } from '../lib/crypto.js';

// Public, unauthenticated health endpoint for external uptime monitoring.
// Reachable through nginx as GET /api/health (the root-level /ping is internal-only,
// used by the Docker healthcheck). Probes the DB so "API up but DB down" is distinguishable.
export async function healthRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/health',
    schema: {
      tags: ['Health'],
      summary: 'Service + database health check (public)',
    },
    // No preHandler on purpose: this must be callable without an API key.
    handler: async (_request, reply) => {
      // 'locked' after every restart until an ADMIN posts the master key to
      // /api/admin/unlock; uptime monitoring should alert on a lasting lock.
      const encryption = isUnlocked() ? 'unlocked' : 'locked';
      try {
        await prisma.$queryRaw`SELECT 1`;
        // Non-secret fingerprint of the expected master key, so an operator can
        // confirm which key (dev vs prod) a server wants before unlocking.
        const keyFingerprint = await getStoredKeyFingerprint(prisma);
        return { status: 'ok', db: 'ok', encryption, keyFingerprint, time: new Date().toISOString() };
      } catch (err) {
        return reply.status(503).send({
          status: 'error',
          db: 'down',
          encryption,
          time: new Date().toISOString(),
        });
      }
    },
  });
}
