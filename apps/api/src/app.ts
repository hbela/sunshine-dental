import { FastifyInstance } from 'fastify'
import { authRoutes } from './routes/auth.routes.js'
import { openapiPlugin } from './plugins/openapi.plugin.js'
import { calendarRoutes } from './routes/calendar.routes.js'
import { providersRoutes } from './routes/providers.routes.js'
import { appointmentsRoutes } from './routes/appointments.routes.js'
import { patientsRoutes } from './routes/patients.routes.js'
import { callLogsRoutes } from './routes/call-logs.routes.js'
import { adminRoutes } from './routes/admin.routes.js'

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
    reply.send(error)
  })

  fastify.get('/ping', async (request, reply) => {
    return { status: 'ok' }
  })

  // Register OpenAPI docs
  await fastify.register(openapiPlugin)

  // Register better-auth routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Register App API routes
  await fastify.register(calendarRoutes, { prefix: '/api/calendar' })
  await fastify.register(providersRoutes, { prefix: '/api/providers' })
  await fastify.register(appointmentsRoutes, { prefix: '/api/appointments' })
  await fastify.register(patientsRoutes, { prefix: '/api/patients' })
  await fastify.register(callLogsRoutes, { prefix: '/api/call-logs' })
  await fastify.register(adminRoutes, { prefix: '/api/admin' })
}
