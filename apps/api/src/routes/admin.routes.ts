import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/auth.js';

const RoleSchema = z.enum(['PROVIDER', 'ASSISTANT']);

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: RoleSchema,
  // Provider-specific fields (only when role = PROVIDER)
  specialty: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

const UpdateRoleBody = z.object({
  role: z.enum(['PROVIDER', 'ASSISTANT', 'ADMIN']),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // POST /api/admin/users — create a provider or assistant with a temporary password
  fastify.route({
    method: 'POST',
    url: '/users',
    schema: {
      tags: ['Admin'],
      summary: 'Create a provider or assistant with a temporary password',
      body: CreateUserBody,
      response: {
        201: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          temporaryPassword: z.string(),
          providerId: z.string().nullable().optional(),
        }),
        400: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['ADMIN'])],
    handler: async (request, reply) => {
      const { name, email, password, role, specialty, phone, bio } = request.body as z.infer<typeof CreateUserBody>;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'A user with this email already exists' });
      }

      // Create user via better-auth signUp (this hashes the password)
      const signUpResult = await auth.api.signUpEmail({
        body: { name, email, password },
      });

      if (!signUpResult?.user) {
        return reply.status(400).send({ error: 'Failed to create user' });
      }

      const userId = signUpResult.user.id;

      // Update role
      await prisma.user.update({
        where: { id: userId },
        data: { role: role as any },
      });

      // If PROVIDER, create provider profile
      let providerId: string | null = null;
      if (role === 'PROVIDER') {
        const provider = await prisma.provider.create({
          data: {
            userId,
            specialty: specialty || null,
            phone: phone || null,
            bio: bio || null,
          },
        });
        providerId = provider.id;
      }

      return reply.status(201).send({
        id: userId,
        name,
        email,
        role,
        temporaryPassword: password,
        providerId,
      });
    },
  });

  // GET /api/admin/users — list all users with optional role filter
  fastify.route({
    method: 'GET',
    url: '/users',
    schema: {
      tags: ['Admin'],
      summary: 'List all users (optionally filter by role)',
      querystring: z.object({
        role: z.enum(['PROVIDER', 'ASSISTANT', 'ADMIN']).optional(),
      }),
      response: {
        200: z.array(z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          role: z.string(),
          createdAt: z.string(),
        })),
      },
    },
    preHandler: [requireAuth, requireRole(['ADMIN'])],
    handler: async (request, reply) => {
      const { role } = request.query as { role?: string };
      const where = role ? { role: role as any } : {};
      const users = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }));
    },
  });

  // PATCH /api/admin/users/:id/role — update a user's role
  fastify.route({
    method: 'PATCH',
    url: '/users/:id/role',
    schema: {
      tags: ['Admin'],
      summary: "Update a user's role",
      params: z.object({ id: z.string() }),
      body: UpdateRoleBody,
      response: {
        200: z.object({ id: z.string(), role: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { role } = request.body as z.infer<typeof UpdateRoleBody>;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // If upgrading to PROVIDER, create provider profile if it doesn't exist
      if (role === 'PROVIDER') {
        const existingProfile = await prisma.provider.findUnique({ where: { userId: id } });
        if (!existingProfile) {
          await prisma.provider.create({ data: { userId: id } });
        }
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { role: role as any },
      });

      return { id: updated.id, role: updated.role };
    },
  });

  // DELETE /api/admin/users/:id — delete a user
  fastify.route({
    method: 'DELETE',
    url: '/users/:id',
    schema: {
      tags: ['Admin'],
      summary: 'Delete a user',
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Cascade will handle provider profile, sessions, accounts, etc.
      await prisma.user.delete({ where: { id } });

      return { success: true };
    },
  });
}
