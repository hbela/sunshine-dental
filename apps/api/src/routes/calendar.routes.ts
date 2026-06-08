import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';
import { DelegationService } from '../services/delegation.service.js';
import { prisma } from '../lib/prisma.js';

export async function calendarRoutes(fastify: FastifyInstance) {
  // GET /api/calendar/slots — get available appointment slots (used by n8n/Retell)
  fastify.route({
    method: 'GET',
    url: '/slots',
    schema: {
      tags: ['Calendar'],
      summary: 'Get available appointment slots',
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { provider_id, provider_name, date, appointment_type } = request.query as any;

      if (!date || !appointment_type) {
        return reply.status(400).send({ error: 'date and appointment_type are required' });
      }
      
      try {
        const result = await CalendarService.getAvailableSlots(date, appointment_type, provider_id, provider_name);
        return result;
      } catch (err: any) {
        if (err.message === 'Provider not found') {
          return reply.status(404).send({ error: 'Provider not found' });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    },
  });

  // GET /api/calendar/available-providers — list providers with slots on a given date (used by n8n/Retell)
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
      const result = await CalendarService.getAvailableProviders(date, appointment_type);
      return result;
    },
  });

  // GET /api/calendar/:provider_id/events — get events for a date range (for react-big-calendar)
  fastify.route({
    method: 'GET',
    url: '/:provider_id/events',
    schema: {
      tags: ['Calendar'],
      summary: 'Get aggregated events for a date range (for react-big-calendar)',
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

      const allowed = await DelegationService.canManageProviderCalendar(user, body.providerId);
      if (!allowed) {
        return reply.status(403).send({ error: 'Not authorized to manage this provider calendar' });
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

      const allowed = await DelegationService.canManageProviderCalendar(user, existing.providerId);
      if (!allowed) {
        return reply.status(403).send({ error: 'Not authorized to manage this provider calendar' });
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

      const allowed = await DelegationService.canManageProviderCalendar(user, existing.providerId);
      if (!allowed) {
        return reply.status(403).send({ error: 'Not authorized to manage this provider calendar' });
      }

      await CalendarService.deleteEvent(id);
      return { success: true };
    },
  });
}
