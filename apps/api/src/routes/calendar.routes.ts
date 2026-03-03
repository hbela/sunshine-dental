import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';
import { CalendarEventSchema, CalendarEventTypeSchema } from '@repo/shared';

export async function calendarRoutes(fastify: FastifyInstance) {
  // GET /api/calendar/slots — get available appointment slots (used by n8n/Retell)
  fastify.route({
    method: 'GET',
    url: '/slots',
    schema: {
      tags: ['Calendar'],
      summary: 'Get available appointment slots',
      querystring: z.object({
        provider_id: z.string().optional(),
        provider_name: z.string().optional(),
        date: z.string(), // YYYY-MM-DD
        appointment_type: z.string(),
      }),
      response: {
        200: z.object({
          slots: z.array(z.string()),
          duration: z.number(),
          provider_name: z.string().optional(),
        }),
        404: z.object({ error: z.string() }),
        500: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { provider_id, provider_name, date, appointment_type } = request.query as any;
      
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

  // GET /api/calendar/:provider_id/events — get events for a date range (for react-big-calendar)
  fastify.route({
    method: 'GET',
    url: '/:provider_id/events',
    schema: {
      tags: ['Calendar'],
      summary: 'Get aggregated events for a date range (for react-big-calendar)',
      params: z.object({ provider_id: z.string() }),
      querystring: z.object({ from: z.string(), to: z.string() }),
      response: {
        200: z.array(CalendarEventSchema),
      },
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
      body: z.object({
        providerId: z.string(),
        title: z.string(),
        start: z.string(), // ISO datetime
        end: z.string(),   // ISO datetime
        allDay: z.boolean().default(false),
        type: CalendarEventTypeSchema.default('AVAILABLE'),
        recurrence: z.string().optional(),
        notes: z.string().optional(),
      }),
      response: {
        201: CalendarEventSchema,
        403: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const body = request.body as any;
      // @ts-ignore
      const userId = request.user?.id;

      const event = await CalendarService.createEvent({
        ...body,
        createdBy: userId,
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
      params: z.object({ id: z.string() }),
      body: z.object({
        title: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        allDay: z.boolean().optional(),
        type: CalendarEventTypeSchema.optional(),
        recurrence: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      response: {
        200: CalendarEventSchema,
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      try {
        const event = await CalendarService.updateEvent(id, body);
        return event;
      } catch (err: any) {
        return reply.status(404).send({ error: 'Event not found' });
      }
    },
  });

  // DELETE /api/calendar/events/:id — delete a calendar event
  fastify.route({
    method: 'DELETE',
    url: '/events/:id',
    schema: {
      tags: ['Calendar'],
      summary: 'Delete a calendar event',
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: z.object({ error: z.string() }),
      },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await CalendarService.deleteEvent(id);
        return { success: true };
      } catch (err: any) {
        return reply.status(404).send({ error: 'Event not found' });
      }
    },
  });
}
