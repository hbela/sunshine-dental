import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
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
    // Any 4xx-class error with a status code — HttpError from services (with
    // or without a machine-readable code), Fastify's own 404s — echoes its
    // status and message. These messages are written for clients.
    if (typeof error?.statusCode === 'number' && error.statusCode < 500) {
      const body: Record<string, string> = { error: error.message }
      if (typeof error?.code === 'string') body.code = error.code
      return reply.status(error.statusCode).send(body)
    }
    // Genuine 5xx / unhandled exceptions reach here — log + report them to
    // Sentry (no-op without SENTRY_DSN), but send a GENERIC body: internal
    // messages (Prisma, Anthropic SDK, crypto internals) must not leak.
    request.log.error(error)
    Sentry.captureException(error)
    reply.status(500).send({ error: 'Internal server error' })
  })

  // CORS — allow the web app origin(s) to send the session cookie.
  await fastify.register(cors, {
    origin: process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  })

  // Security headers. The CSP must allow inline script/style or the Swagger
  // UI at /documentation breaks; everything else stays self-only.
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
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
