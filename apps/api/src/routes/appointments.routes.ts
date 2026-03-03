import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey } from '../middleware/auth.middleware.js';
import { AppointmentSchema, AppointmentTypeSchema } from '@repo/shared';

export async function appointmentsRoutes(fastify: FastifyInstance) {
  // GET /api/appointments
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Appointments'],
      summary: 'List appointments',
      querystring: z.object({
        date: z.string().optional(),
        provider_id: z.string().optional(),
      }),
      response: { 200: z.array(AppointmentSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      return [];
    },
  });

  // POST /api/appointments (Book)
  // Used by n8n
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
        appointment_type: AppointmentTypeSchema,
        date: z.string(), // YYYY-MM-DD
        time: z.string(), // HH:MM
        provider_name: z.string().optional(),
        is_new_patient: z.boolean().default(false),
        notes: z.string().optional(),
        call_id: z.string().optional(),
      }),
      response: { 200: AppointmentSchema },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      // Dummy response
      return {} as any;
    },
  });
}
