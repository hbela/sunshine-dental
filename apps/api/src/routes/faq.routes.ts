import { FastifyInstance } from 'fastify';
import { faqAnswer } from '@repo/shared';
import { clinic } from '../lib/clinic.js';

/**
 * Clinic facts for the voice agent's `get_faq_answer` tool.
 *
 * These answers used to be a hardcoded dictionary inside the n8n router's "FAQ
 * Handler" node, which meant every new clinic needed its own edited copy of the
 * workflow. Serving them from the API instead makes the workflow clinic-
 * agnostic: a duplicated workflow only needs its base URL and API key changed.
 *
 * Non-secret, patient-facing copy — same information the chat receptionist
 * answers inline and the website publishes — so this route is public, like
 * /api/health. Unknown topics/languages degrade to the English answer and then
 * to a "let me have someone call you back" line rather than erroring, so a
 * mis-typed tool argument never dead-ends a live call.
 */
export async function faqRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: 'GET',
    url: '/faq',
    schema: {
      tags: ['FAQ'],
      summary: 'Clinic FAQ answer for a topic + language (public)',
    },
    // Query values are deliberately not schema-validated: `faqAnswer` already
    // degrades an unknown topic or language to the callback line, and a 400 in
    // the middle of a live call would be worse than a graceful answer.
    handler: async (request) => {
      const { topic, language } = request.query as { topic?: string; language?: string };
      const lang = language || clinic.defaultLanguage;
      return {
        clinic: clinic.id,
        topic: topic ?? null,
        language: lang,
        // `result` matches the key the n8n FAQ node already returns to Retell.
        result: faqAnswer(clinic, topic ?? '', lang),
      };
    },
  });
}
