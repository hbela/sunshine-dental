import { FastifyInstance } from 'fastify';
import { faqAnswer } from '@repo/shared';
import { clinic } from '../lib/clinic.js';

/**
 * Clinic facts (hours, location, insurance, parking...) for one topic + language.
 *
 * Built for the retired voice agent's `get_faq_answer` tool; the chat
 * receptionist answers these inline from its prompt instead, so nothing in this
 * repo calls this route any more. It is kept because it is public, non-secret,
 * patient-facing copy generated from the clinic config — the natural endpoint
 * for a clinic website or an embedded widget to read. Remove it if no such
 * consumer appears.
 *
 * Unknown topics/languages degrade to the English answer and then to a "let me
 * have someone call you back" line rather than erroring.
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
        result: faqAnswer(clinic, topic ?? '', lang),
      };
    },
  });
}
