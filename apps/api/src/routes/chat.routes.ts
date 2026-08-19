import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ChatService } from '../services/chat.service.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ChatConversationSchema, ChatConversationDetailSchema } from '@repo/shared';
import { sendError } from '../lib/errors.js';
import { isUnlocked } from '../lib/crypto.js';

/**
 * Patient-facing chat receptionist.
 *
 * Public (unauthenticated) endpoints power the patient chat; they authorize each
 * request with the conversation's secret `token` (issued at creation) rather than
 * a session — patients are not users. Staff endpoints reuse the dashboard session
 * auth like `call-logs.routes.ts` and never expose the token.
 */

// --- tiny in-memory rate limiting (single-instance deployment; best-effort) ---
const WINDOW_MS = 60 * 60 * 1000;
const MAX_CONVOS_PER_IP = 30;
const MAX_MESSAGES_PER_CONVO = 60;
const ipHits = new Map<string, number[]>();
const convoMsgCount = new Map<string, number>();

function ipAllowed(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_CONVOS_PER_IP) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

function convoAllowed(id: string): boolean {
  const n = (convoMsgCount.get(id) ?? 0) + 1;
  convoMsgCount.set(id, n);
  return n <= MAX_MESSAGES_PER_CONVO;
}

export async function chatRoutes(fastify: FastifyInstance) {
  // ---------- Public (patient) ----------

  // POST /api/chat/conversations — start a conversation, get the resume token.
  fastify.route({
    method: 'POST',
    url: '/conversations',
    schema: {
      tags: ['Chat'],
      summary: 'Start a patient chat conversation',
      body: z.object({ language: z.enum(['en', 'hu', 'de']).optional() }),
      response: {
        200: z.object({ id: z.string(), token: z.string() }),
        429: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      if (!ipAllowed(request.ip)) {
        return reply.status(429).send({ error: 'Too many chats started. Please try again later.' });
      }
      const { language } = request.body as { language?: string };
      return ChatService.createConversation(language);
    },
  });

  // POST /api/chat/conversations/:id/messages — send a message, stream the reply (SSE).
  fastify.route({
    method: 'POST',
    url: '/conversations/:id/messages',
    schema: {
      tags: ['Chat'],
      summary: 'Send a patient message and stream the assistant reply (SSE)',
      params: z.object({ id: z.string() }),
      body: z.object({ token: z.string(), message: z.string().min(1).max(2000) }),
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { token, message } = request.body as { token: string; message: string };

      try {
        await ChatService.requireConversation(id, token);
      } catch (err) {
        return sendError(reply, err);
      }
      if (!convoAllowed(id)) {
        return reply.status(429).send({ error: 'Message limit reached for this conversation.' });
      }
      // Must be checked BEFORE hijack — after hijack a clean JSON 503 can no
      // longer be sent (encryption is locked until an admin unlocks it).
      if (!isUnlocked()) {
        return reply
          .status(503)
          .send({ error: 'Chat is temporarily unavailable', code: 'ENCRYPTION_LOCKED' });
      }

      // Server-Sent Events stream.
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
      });
      const send = (event: string, data: unknown) => {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        await ChatService.streamReply(id, message, {
          onText: (delta) => send('delta', { text: delta }),
          onTool: (name) => send('tool', { name }),
        });
        send('done', {});
      } catch (err: any) {
        request.log.error(err);
        send('error', {
          message:
            err?.code === 'ENCRYPTION_LOCKED'
              ? 'chat_locked'
              : err?.statusCode === 503
                ? 'chat_unconfigured'
                : 'chat_error',
        });
      } finally {
        raw.end();
      }
    },
  });

  // POST /api/chat/conversations/:id/end — end the chat (best-effort summary/sentiment).
  fastify.route({
    method: 'POST',
    url: '/conversations/:id/end',
    schema: {
      tags: ['Chat'],
      summary: 'End a patient chat conversation',
      params: z.object({ id: z.string() }),
      body: z.object({ token: z.string() }),
      response: { 200: z.object({ ok: z.boolean() }) },
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { token } = request.body as { token: string };
      try {
        await ChatService.endConversation(id, token);
        return { ok: true };
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /api/chat/conversations/:id/transcript — patient-facing resume after a
  // page reload. Token-authenticated like /messages and /end; the browser
  // persists only id+token (sessionStorage), never the transcript itself.
  fastify.route({
    method: 'POST',
    url: '/conversations/:id/transcript',
    schema: {
      tags: ['Chat'],
      summary: 'Fetch the transcript for a conversation (patient resume)',
      params: z.object({ id: z.string() }),
      body: z.object({ token: z.string() }),
      response: {
        200: z.object({
          messages: z.array(
            z.object({
              id: z.string(),
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
        }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { token } = request.body as { token: string };
      try {
        return await ChatService.transcript(id, token);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ---------- Staff (dashboard) ----------

  // GET /api/chat/stats — aggregated chat statistics (registered before /:id).
  fastify.route({
    method: 'GET',
    url: '/stats',
    schema: {
      tags: ['Chat'],
      summary: 'Aggregated chat statistics',
      response: {
        200: z.object({
          totalChats: z.number(),
          successful: z.number(),
          bySentiment: z.object({ positive: z.number(), neutral: z.number(), negative: z.number() }),
          chatsToday: z.number(),
          chatsThisWeek: z.number(),
        }),
      },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async () => ChatService.stats(),
  });

  // GET /api/chat/conversations — list with filters + pagination.
  fastify.route({
    method: 'GET',
    url: '/conversations',
    schema: {
      tags: ['Chat'],
      summary: 'List chat conversations',
      querystring: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        language: z.enum(['en', 'hu', 'de']).optional(),
        successful: z.enum(['true', 'false']).optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      response: { 200: z.array(ChatConversationSchema) },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async (request) => {
      const q = request.query as any;
      return ChatService.list({
        from: q.from,
        to: q.to,
        language: q.language,
        successful: q.successful === undefined ? undefined : q.successful === 'true',
        page: q.page,
        limit: q.limit,
      });
    },
  });

  // GET /api/chat/conversations/:id — a conversation with its full transcript.
  fastify.route({
    method: 'GET',
    url: '/conversations/:id',
    schema: {
      tags: ['Chat'],
      summary: 'Get a chat conversation with transcript',
      params: z.object({ id: z.string() }),
      response: { 200: ChatConversationDetailSchema, 404: z.object({ error: z.string() }) },
    },
    preHandler: [requireAuth, requireRole(['ASSISTANT', 'ADMIN'])],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return await ChatService.detail(id);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
