import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ProviderSchema } from '@repo/shared';
import { prisma } from '../lib/prisma.js';

const ProviderListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  givenName: z.string(),
  familyName: z.string(),
  specialty: z.string().nullable(),
  phone: z.string().nullable(),
});

function serialize(p: any) {
  return {
    id: p.id,
    userId: p.userId,
    specialty: p.specialty,
    phone: p.phone,
    bio: p.bio,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function providersRoutes(fastify: FastifyInstance) {
  // GET /api/providers — list active providers
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Providers'],
      summary: 'List active providers',
      response: { 200: z.array(ProviderListItemSchema) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async () => {
      const providers = await prisma.provider.findMany({
        where: { isActive: true },
        include: { user: { select: { name: true, title: true, givenName: true, familyName: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return providers.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        title: p.user.title,
        givenName: p.user.givenName,
        familyName: p.user.familyName,
        specialty: p.specialty,
        phone: p.phone,
      }));
    },
  });

  // PUT /api/providers/me — update own profile (PROVIDER only)
  fastify.route({
    method: 'PUT',
    url: '/me',
    schema: {
      tags: ['Providers'],
      summary: 'Update own provider profile',
      body: z.object({
        specialty: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
      }),
      response: { 200: ProviderSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER'])],
    handler: async (request, reply) => {
      // @ts-ignore — set by requireAuth
      const userId = request.user?.id as string;
      const body = request.body as { specialty?: string; phone?: string; bio?: string };

      const provider = await prisma.provider.findUnique({ where: { userId } });
      if (!provider) {
        return reply.status(404).send({ error: 'Provider profile not found' });
      }

      const data: any = {};
      if (body.specialty !== undefined) data.specialty = body.specialty;
      if (body.phone !== undefined) data.phone = body.phone;
      if (body.bio !== undefined) data.bio = body.bio;

      const updated = await prisma.provider.update({ where: { userId }, data });
      return serialize(updated);
    },
  });

  // GET /api/providers/:id — get provider profile
  fastify.route({
    method: 'GET',
    url: '/:id',
    schema: {
      tags: ['Providers'],
      summary: 'Get provider profile',
      params: z.object({ id: z.string() }),
      response: { 200: ProviderSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const provider = await prisma.provider.findUnique({ where: { id } });
      if (!provider) {
        return reply.status(404).send({ error: 'Provider not found' });
      }
      return serialize(provider);
    },
  });
}
