import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { AppointmentSchema } from '@repo/shared';
import { AppointmentService } from '../services/appointment.service.js';
import { sendError } from '../lib/errors.js';

export async function appointmentsRoutes(fastify: FastifyInstance) {
  // GET /api/appointments — list with filters + pagination
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Appointments'],
      summary: 'List appointments',
      querystring: z.object({
        date: z.string().optional(),
        provider_id: z.string().optional(),
        status: z.string().optional(),
        patient_name: z.string().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.array(AppointmentSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request) => {
      const q = request.query as any;
      return AppointmentService.list({
        date: q.date,
        providerId: q.provider_id,
        status: q.status,
        patientName: q.patient_name,
        page: q.page,
        limit: q.limit,
      });
    },
  });

  // GET /api/appointments/patient/:patient_id — patient appointment history
  fastify.route({
    method: 'GET',
    url: '/patient/:patient_id',
    schema: {
      tags: ['Appointments'],
      summary: 'Get a patient appointment history',
      params: z.object({ patient_id: z.string() }),
      response: { 200: z.array(AppointmentSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request) => {
      const { patient_id } = request.params as { patient_id: string };
      return AppointmentService.patientHistory(patient_id);
    },
  });

  // GET /api/appointments/:id — single appointment
  fastify.route({
    method: 'GET',
    url: '/:id',
    schema: {
      tags: ['Appointments'],
      summary: 'Get an appointment by id',
      params: z.object({ id: z.string() }),
      response: { 200: AppointmentSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await AppointmentService.findById(id);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /api/appointments — book (n8n or ASSISTANT)
  fastify.route({
    method: 'POST',
    url: '/',
    schema: {
      tags: ['Appointments'],
      summary: 'Book an appointment',
      body: z.object({
        patient_name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        // Validated against the clinic's own service list in AppointmentService.book,
        // which returns a 400 naming the valid codes.
        appointment_type: z.string(),
        date: z.string(), // YYYY-MM-DD
        time: z.string(), // HH:MM
        provider_id: z.string().optional(),
        provider_name: z.string().optional(),
        is_new_patient: z.boolean().default(false),
        notes: z.string().optional(),
      }),
      response: { 200: AppointmentSchema },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      try {
        return await AppointmentService.book(request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // PUT /api/appointments/cancel — n8n cancel-by-search flow
  fastify.route({
    method: 'PUT',
    url: '/cancel',
    schema: {
      tags: ['Appointments'],
      summary: 'Cancel an appointment by patient name + date (n8n)',
      body: z.object({
        patient_name: z.string(),
        date: z.string(),
        time: z.string().optional(),
        reason: z.string().optional(),
      }),
      response: {
        200: z.object({ found: z.boolean(), appointment: AppointmentSchema.optional() }),
      },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      try {
        return await AppointmentService.cancelBySearch(request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // PUT /api/appointments/:id/cancel — cancel by id (web app)
  fastify.route({
    method: 'PUT',
    url: '/:id/cancel',
    schema: {
      tags: ['Appointments'],
      summary: 'Cancel an appointment by id',
      params: z.object({ id: z.string() }),
      body: z.object({ reason: z.string().optional() }).optional(),
      response: { 200: AppointmentSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body as { reason?: string }) ?? {};
      try {
        return await AppointmentService.cancelById(id, body.reason);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // PUT /api/appointments/:id/complete — mark completed (PROVIDER/ADMIN)
  fastify.route({
    method: 'PUT',
    url: '/:id/complete',
    schema: {
      tags: ['Appointments'],
      summary: 'Mark an appointment as completed',
      params: z.object({ id: z.string() }),
      response: { 200: AppointmentSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['PROVIDER', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await AppointmentService.complete(id);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
