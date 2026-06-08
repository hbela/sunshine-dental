import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey } from '../middleware/auth.middleware.js';
import { PatientSchema, AppointmentSchema } from '@repo/shared';
import { PatientService } from '../services/patient.service.js';
import { sendError } from '../lib/errors.js';

const PatientWithHistorySchema = PatientSchema.extend({
  appointments: z.array(AppointmentSchema),
});

export async function patientsRoutes(fastify: FastifyInstance) {
  // GET /api/patients — list with search + pagination
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Patients'],
      summary: 'List patients',
      querystring: z.object({
        search: z.string().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.array(PatientSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request) => {
      const q = request.query as any;
      return PatientService.list({ search: q.search, page: q.page, limit: q.limit });
    },
  });

  // GET /api/patients/:id — details + appointment history
  fastify.route({
    method: 'GET',
    url: '/:id',
    schema: {
      tags: ['Patients'],
      summary: 'Get a patient with appointment history',
      params: z.object({ id: z.string() }),
      response: { 200: PatientWithHistorySchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await PatientService.findByIdWithHistory(id);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /api/patients — capture patient info (n8n voice agent)
  fastify.route({
    method: 'POST',
    url: '/',
    schema: {
      tags: ['Patients'],
      summary: 'Create a patient record',
      body: z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        reason: z.string().optional(),
        is_new_patient: z.boolean().default(true),
        callback_requested: z.boolean().default(false),
        preferred_time: z.string().optional(),
        call_id: z.string().optional(),
      }),
      response: { 200: PatientSchema },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      try {
        return await PatientService.create(request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // PUT /api/patients/:id — update patient info
  fastify.route({
    method: 'PUT',
    url: '/:id',
    schema: {
      tags: ['Patients'],
      summary: 'Update a patient record',
      params: z.object({ id: z.string() }),
      body: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        reason: z.string().optional(),
        is_new_patient: z.boolean().optional(),
        callback_requested: z.boolean().optional(),
        preferred_time: z.string().optional(),
        notes: z.string().optional(),
      }),
      response: { 200: PatientSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await PatientService.update(id, request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
