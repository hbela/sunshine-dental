import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ProviderSchema } from '@repo/shared';

export async function providersRoutes(fastify: FastifyInstance) {
  // GET /api/providers
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Providers'],
      summary: 'List active providers',
      response: {
        200: z.array(ProviderSchema.pick({ id: true, userId: true, specialty: true, phone: true })),
      },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      return [];
    },
  });

  // GET /api/providers/:id
  fastify.route({
    method: 'GET',
    url: '/:id',
    schema: {
      tags: ['Providers'],
      summary: 'Get provider profile',
      params: z.object({ id: z.string() }),
      response: { 200: ProviderSchema },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      return { id: '', userId: '', specialty: '', phone: '', bio: '', isActive: true, createdAt: '', updatedAt: '' };
    },
  });
}
