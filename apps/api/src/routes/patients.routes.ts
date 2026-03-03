import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey } from '../middleware/auth.middleware.js';
import { PatientSchema } from '@repo/shared';

export async function patientsRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Patients'],
      summary: 'List patients',
      response: { 200: z.array(PatientSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      return [];
    },
  });

  // Used by n8n
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
      return {} as any;
    },
  });
}
