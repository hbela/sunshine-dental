import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  requireAuthOrApiKey,
  requireAuth,
  requireRole,
} from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';
import { DelegationService } from '../services/delegation.service.js';
import { prisma } from '../lib/prisma.js';
import {
  AvailabilityExceptionInputSchema,
  AvailabilityExceptionSchema,
  AvailabilityPatternInputSchema,
  AvailabilityPatternSchema,
} from '@repo/shared';
import { AvailabilityPatternService } from '../services/availability-pattern.service.js';

export async function calendarRoutes(fastify: FastifyInstance) {
  const staffOnly = [
    requireAuth,
    requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN']),
  ];

  fastify.route({
    method: 'GET',
    url: '/:provider_id/availability-patterns',
    schema: {
      tags: ['Calendar'],
      summary: 'List provider availability patterns',
      params: z.object({ provider_id: z.string() }),
      response: { 200: z.array(AvailabilityPatternSchema) },
    },
    preHandler: staffOnly,
    handler: async (request) => {
      const { provider_id } = request.params as { provider_id: string };
      return AvailabilityPatternService.list(provider_id);
    },
  });

  fastify.route({
    method: 'POST',
    url: '/:provider_id/availability-patterns',
    schema: {
      tags: ['Calendar'],
      summary: 'Create an availability pattern',
      params: z.object({ provider_id: z.string() }),
      body: AvailabilityPatternInputSchema,
      response: {
        201: AvailabilityPatternSchema,
        403: z.object({ error: z.string() }),
      },
    },
    preHandler: staffOnly,
    handler: async (request, reply) => {
      const { provider_id } = request.params as { provider_id: string };
      const user = (request as any).user as
        | { id: string; role: string }
        | undefined;
      if (
        !(await DelegationService.canManageProviderCalendar(user, provider_id))
      ) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }
      const result = await AvailabilityPatternService.create(
        provider_id,
        request.body as any,
        user?.id,
      );
      return reply.status(201).send(result);
    },
  });

  fastify.route({
    method: 'PUT',
    url: '/availability-patterns/:id',
    schema: {
      tags: ['Calendar'],
      summary: 'Update an availability pattern',
      params: z.object({ id: z.string() }),
      body: AvailabilityPatternInputSchema,
      response: {
        200: AvailabilityPatternSchema,
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: staffOnly,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as
        | { id: string; role: string }
        | undefined;
      const pattern = await prisma.availabilityPattern.findUnique({
        where: { id },
      });
      if (!pattern)
        return reply
          .status(404)
          .send({ error: 'Availability pattern not found' });
      if (
        !(await DelegationService.canManageProviderCalendar(
          user,
          pattern.providerId,
        ))
      ) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }
      return AvailabilityPatternService.update(id, request.body as any);
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/availability-patterns/:id',
    schema: {
      tags: ['Calendar'],
      summary: 'Delete an availability pattern',
      params: z.object({ id: z.string() }),
    },
    preHandler: staffOnly,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as
        | { id: string; role: string }
        | undefined;
      const pattern = await prisma.availabilityPattern.findUnique({
        where: { id },
      });
      if (!pattern)
        return reply
          .status(404)
          .send({ error: 'Availability pattern not found' });
      if (
        !(await DelegationService.canManageProviderCalendar(
          user,
          pattern.providerId,
        ))
      ) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }
      await AvailabilityPatternService.remove(id);
      return { success: true };
    },
  });

  fastify.route({
    method: 'PUT',
    url: '/availability-patterns/:id/exceptions',
    schema: {
      tags: ['Calendar'],
      summary: 'Create or replace an availability exception',
      params: z.object({ id: z.string() }),
      body: AvailabilityExceptionInputSchema,
      response: {
        200: AvailabilityExceptionSchema,
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: staffOnly,
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = (request as any).user as
        | { id: string; role: string }
        | undefined;
      const pattern = await prisma.availabilityPattern.findUnique({
        where: { id },
      });
      if (!pattern)
        return reply
          .status(404)
          .send({ error: 'Availability pattern not found' });
      if (
        !(await DelegationService.canManageProviderCalendar(
          user,
          pattern.providerId,
        ))
      ) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }
      return AvailabilityPatternService.upsertException(
        id,
        request.body as any,
        user?.id,
      );
    },
  });

  fastify.route({
    method: 'DELETE',
    url: '/availability-patterns/:id/exceptions/:exception_id',
    schema: {
      tags: ['Calendar'],
      summary: 'Delete an availability exception',
      params: z.object({ id: z.string(), exception_id: z.string() }),
    },
    preHandler: staffOnly,
    handler: async (request, reply) => {
      const { id, exception_id } = request.params as {
        id: string;
        exception_id: string;
      };
      const user = (request as any).user as
        | { id: string; role: string }
        | undefined;
      const pattern = await prisma.availabilityPattern.findUnique({
        where: { id },
      });
      if (!pattern)
        return reply
          .status(404)
          .send({ error: 'Availability pattern not found' });
      if (
        !(await DelegationService.canManageProviderCalendar(
          user,
          pattern.providerId,
        ))
      ) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }
      await AvailabilityPatternService.removeException(id, exception_id);
      return { success: true };
    },
  });

  // GET /api/calendar/slots — get available appointment slots (used by the chat agent)
  fastify.route({
    method: 'GET',
    url: '/slots',
    schema: {
      tags: ['Calendar'],
      summary: 'Get available appointment slots',
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { provider_id, provider_name, date, appointment_type } =
        request.query as any;

      if (!date || !appointment_type) {
        return reply
          .status(400)
          .send({ error: 'date and appointment_type are required' });
      }

      try {
        const result = await CalendarService.getAvailableSlots(
          date,
          appointment_type,
          provider_id,
          provider_name,
        );
        return result;
      } catch (err: any) {
        if (err.message === 'Provider not found') {
          return reply.status(404).send({ error: 'Provider not found' });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  // GET /api/calendar/available-providers — list providers with slots on a given date (used by the chat agent)
  fastify.route({
    method: 'GET',
    url: '/available-providers',
    schema: {
      tags: ['Calendar'],
      summary: 'List providers that have available slots on a given date',
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { date, appointment_type } = request.query as any;
      if (!date) {
        return reply.status(400).send({ error: 'date is required' });
      }
      const result = await CalendarService.getAvailableProviders(
        date,
        appointment_type,
      );
      return result;
    },
  });

  // GET /api/calendar/:provider_id/events — get events for a date range (for react-big-calendar)
  fastify.route({
    method: 'GET',
    url: '/:provider_id/events',
    schema: {
      tags: ['Calendar'],
      summary:
        'Get aggregated events for a date range (for react-big-calendar)',
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { provider_id } = request.params as { provider_id: string };
      const { from, to } = request.query as { from: string; to: string };

      const events = await CalendarService.getEvents(provider_id, from, to);
      return events;
    },
  });

  // POST /api/calendar/events — create a calendar event
  fastify.route({
    method: 'POST',
    url: '/events',
    schema: {
      tags: ['Calendar'],
      summary: 'Create a calendar event (provider or delegated assistant)',
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const body = request.body as any;
      // @ts-ignore — set by requireAuth
      const user = request.user as { id: string; role: string } | undefined;

      const allowed = await DelegationService.canManageProviderCalendar(
        user,
        body.providerId,
      );
      if (!allowed) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }

      const event = await CalendarService.createEvent({
        ...body,
        createdBy: user?.id,
      });
      return reply.status(201).send(event);
    },
  });

  // PUT /api/calendar/events/:id — update a calendar event
  fastify.route({
    method: 'PUT',
    url: '/events/:id',
    schema: {
      tags: ['Calendar'],
      summary: 'Update a calendar event',
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      // @ts-ignore — set by requireAuth
      const user = request.user as { id: string; role: string } | undefined;

      const existing = await prisma.calendarEvent.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      if (existing.availabilityPatternId) {
        return reply.status(409).send({
          error:
            'Pattern-managed availability must be edited from availability patterns',
        });
      }

      const allowed = await DelegationService.canManageProviderCalendar(
        user,
        existing.providerId,
      );
      if (!allowed) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }

      const event = await CalendarService.updateEvent(id, body);
      return event;
    },
  });

  // DELETE /api/calendar/events/:id — delete a calendar event
  fastify.route({
    method: 'DELETE',
    url: '/events/:id',
    schema: {
      tags: ['Calendar'],
      summary: 'Delete a calendar event',
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      // @ts-ignore — set by requireAuth
      const user = request.user as { id: string; role: string } | undefined;

      const existing = await prisma.calendarEvent.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Event not found' });
      }

      if (existing.availabilityPatternId) {
        return reply.status(409).send({
          error:
            'Pattern-managed availability must be edited from availability patterns',
        });
      }

      const allowed = await DelegationService.canManageProviderCalendar(
        user,
        existing.providerId,
      );
      if (!allowed) {
        return reply
          .status(403)
          .send({ error: 'Not authorized to manage this provider calendar' });
      }

      await CalendarService.deleteEvent(id);
      return { success: true };
    },
  });
}
