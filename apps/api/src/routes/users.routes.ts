import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export async function usersRoutes(fastify: FastifyInstance) {
  // GET /api/users — lightweight directory (id + name + role), optionally
  // filtered by role. Used by delegation pickers and to resolve delegate/owner
  // names. Read-only and excludes PII like email; admin user management lives
  // under /api/admin/users.
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Users'],
      summary: 'List users (id, name, role) for pickers',
      querystring: z.object({
        role: z.enum(['PROVIDER', 'ASSISTANT', 'ADMIN']).optional(),
      }),
      response: {
        200: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
          }),
        ),
      },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request) => {
      const { role } = request.query as { role?: string };
      const where = role ? { role: role as any } : {};
      return prisma.user.findMany({
        where,
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });
    },
  });
}
