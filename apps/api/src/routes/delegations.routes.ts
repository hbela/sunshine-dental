import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { DelegationService } from '../services/delegation.service.js';
import { sendError } from '../lib/errors.js';

const DelegationSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  delegateId: z.string(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canBook: z.boolean(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function delegationsRoutes(fastify: FastifyInstance) {
  // GET /api/delegations/me — delegations I own + delegations granted to me
  fastify.route({
    method: 'GET',
    url: '/me',
    schema: {
      tags: ['Delegations'],
      summary: 'List my delegations (owned + received)',
      response: {
        200: z.object({
          owned: z.array(DelegationSchema),
          received: z.array(DelegationSchema),
        }),
      },
    },
    preHandler: [requireAuth],
    handler: async (request) => {
      // @ts-ignore — set by requireAuth
      const userId = request.user?.id as string;
      return DelegationService.forUser(userId);
    },
  });

  // POST /api/delegations — create (PROVIDER grants, or ADMIN)
  fastify.route({
    method: 'POST',
    url: '/',
    schema: {
      tags: ['Delegations'],
      summary: 'Create a calendar delegation',
      body: z.object({
        ownerId: z.string(),
        delegateId: z.string(),
        canView: z.boolean().optional(),
        canEdit: z.boolean().optional(),
        canBook: z.boolean().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
      }),
      response: { 201: DelegationSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ADMIN'])],
    handler: async (request, reply) => {
      try {
        const delegation = await DelegationService.create(request.body as any);
        return reply.status(201).send(delegation);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // PUT /api/delegations/:id — update permissions / extend dates
  fastify.route({
    method: 'PUT',
    url: '/:id',
    schema: {
      tags: ['Delegations'],
      summary: 'Update a calendar delegation',
      params: z.object({ id: z.string() }),
      body: z.object({
        canView: z.boolean().optional(),
        canEdit: z.boolean().optional(),
        canBook: z.boolean().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
      }),
      response: { 200: DelegationSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await DelegationService.update(id, request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // DELETE /api/delegations/:id — revoke
  fastify.route({
    method: 'DELETE',
    url: '/:id',
    schema: {
      tags: ['Delegations'],
      summary: 'Revoke a calendar delegation',
      params: z.object({ id: z.string() }),
      response: { 200: z.object({ success: z.boolean() }), 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await DelegationService.remove(id);
        return { success: true };
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
