import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

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
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', db: 'ok', time: new Date().toISOString() };
      } catch (err) {
        return reply.status(503).send({
          status: 'error',
          db: 'down',
          time: new Date().toISOString(),
        });
      }
    },
  });
}
