import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import * as Sentry from '@sentry/node'
import { authRoutes } from './routes/auth.routes.js'
import openapiPlugin from './plugins/openapi.plugin.js'
import { calendarRoutes } from './routes/calendar.routes.js'
import { healthRoutes } from './routes/health.routes.js'
import { providersRoutes } from './routes/providers.routes.js'
import { appointmentsRoutes } from './routes/appointments.routes.js'
import { patientsRoutes } from './routes/patients.routes.js'
import { adminRoutes } from './routes/admin.routes.js'
import { delegationsRoutes } from './routes/delegations.routes.js'
import { usersRoutes } from './routes/users.routes.js'
import { chatRoutes } from './routes/chat.routes.js'
import { faqRoutes } from './routes/faq.routes.js'

export async function app(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: any, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: error.validation,
      })
    }
    // HttpErrors carrying a machine-readable code (e.g. ENCRYPTION_LOCKED)
    // keep it in the payload so the web app and n8n can branch on it.
    if (typeof error?.statusCode === 'number' && typeof error?.code === 'string') {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code })
    }
    // Genuine 5xx / unhandled exceptions reach here — report them to Sentry
    // (no-op without SENTRY_DSN). Validation 400s and coded HttpErrors above
    // return early and are deliberately NOT reported.
    Sentry.captureException(error)
    reply.send(error)
  })

  // CORS — allow the web app origin(s) to send the session cookie.
  await fastify.register(cors, {
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  })

  fastify.get('/ping', async (request, reply) => {
    return { status: 'ok' }
  })

  // Register OpenAPI docs
  await fastify.register(openapiPlugin)

  // Register better-auth routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Register App API routes
  await fastify.register(healthRoutes, { prefix: '/api' })
  await fastify.register(faqRoutes, { prefix: '/api' })
  await fastify.register(calendarRoutes, { prefix: '/api/calendar' })
  await fastify.register(providersRoutes, { prefix: '/api/providers' })
  await fastify.register(appointmentsRoutes, { prefix: '/api/appointments' })
  await fastify.register(patientsRoutes, { prefix: '/api/patients' })
  await fastify.register(adminRoutes, { prefix: '/api/admin' })
  await fastify.register(delegationsRoutes, { prefix: '/api/delegations' })
  await fastify.register(usersRoutes, { prefix: '/api/users' })
  await fastify.register(chatRoutes, { prefix: '/api/chat' })
}
