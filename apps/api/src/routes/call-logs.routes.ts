import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey } from '../middleware/auth.middleware.js';
import { CallLogSchema } from '@repo/shared';

export async function callLogsRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Call Logs'],
      summary: 'List call logs',
      response: { 200: z.array(CallLogSchema) },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      return [];
    },
  });

  // Used by n8n Webhook post-call processing
  fastify.route({
    method: 'POST',
    url: '/',
    schema: {
      tags: ['Call Logs'],
      summary: 'Create a post-call log',
      body: z.object({
        call_id: z.string(),
        agent_id: z.string().optional(),
        from_number: z.string().optional(),
        to_number: z.string().optional(),
        duration_seconds: z.number().optional(),
        disconnection_reason: z.string().optional(),
        transcript: z.string().optional(),
        summary: z.string().optional(),
        sentiment: z.string().optional(),
        successful: z.boolean().optional(),
      }),
      response: { 200: CallLogSchema },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      return {} as any;
    },
  });
}
