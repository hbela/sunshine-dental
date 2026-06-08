import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuthOrApiKey, requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { CallLogSchema } from '@repo/shared';
import { CallLogService } from '../services/call-log.service.js';
import { sendError } from '../lib/errors.js';

const StatsSchema = z.object({
  totalCalls: z.number(),
  successful: z.number(),
  bySentiment: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
  }),
  avgDurationSeconds: z.number(),
  callsToday: z.number(),
  callsThisWeek: z.number(),
});

export async function callLogsRoutes(fastify: FastifyInstance) {
  // POST /api/call-logs — post-call webhook (n8n). Idempotent on call_id.
  fastify.route({
    method: 'POST',
    url: '/',
    schema: {
      tags: ['Call Logs'],
      summary: 'Create or update a post-call log',
      body: z.object({
        call_id: z.string(),
        agent_id: z.string().optional(),
        patient_id: z.string().optional(),
        from_number: z.string().optional(),
        to_number: z.string().optional(),
        direction: z.string().optional(),
        duration_seconds: z.number().optional(),
        status: z.string().optional(),
        disconnection_reason: z.string().optional(),
        transcript: z.string().optional(),
        summary: z.string().optional(),
        sentiment: z.string().optional(),
        successful: z.boolean().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
      }),
      response: { 200: CallLogSchema },
    },
    preHandler: [requireAuthOrApiKey],
    handler: async (request, reply) => {
      try {
        return await CallLogService.create(request.body as any);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // GET /api/call-logs/stats — aggregated stats (registered before /:call_id)
  fastify.route({
    method: 'GET',
    url: '/stats',
    schema: {
      tags: ['Call Logs'],
      summary: 'Aggregated call statistics',
      response: { 200: StatsSchema },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async () => {
      return CallLogService.stats();
    },
  });

  // GET /api/call-logs — list with filters + pagination
  fastify.route({
    method: 'GET',
    url: '/',
    schema: {
      tags: ['Call Logs'],
      summary: 'List call logs',
      querystring: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        sentiment: z.string().optional(),
        successful: z.enum(['true', 'false']).optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.array(CallLogSchema) },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async (request) => {
      const q = request.query as any;
      return CallLogService.list({
        from: q.from,
        to: q.to,
        sentiment: q.sentiment,
        successful: q.successful === undefined ? undefined : q.successful === 'true',
        page: q.page,
        limit: q.limit,
      });
    },
  });

  // GET /api/call-logs/:call_id — single call log + transcript
  fastify.route({
    method: 'GET',
    url: '/:call_id',
    schema: {
      tags: ['Call Logs'],
      summary: 'Get a single call log by Retell call_id',
      params: z.object({ call_id: z.string() }),
      response: { 200: CallLogSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { call_id } = request.params as { call_id: string };
      try {
        return await CallLogService.findByCallId(call_id);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
