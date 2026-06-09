import { FastifyPluginAsync } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../lib/auth.js'

const allowedOrigins = process.env.WEB_ORIGIN?.split(',') ?? ['http://localhost:5173']

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // better-auth writes directly to reply.raw, bypassing @fastify/cors, so CORS
  // headers must be applied to the raw response here.
  fastify.all('/*', async (request, reply) => {
    const origin = request.headers.origin
    if (origin && allowedOrigins.includes(origin)) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin)
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
      reply.raw.setHeader('Vary', 'Origin')
    }

    if (request.method === 'OPTIONS') {
      reply.raw.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      reply.raw.setHeader(
        'Access-Control-Allow-Headers',
        (request.headers['access-control-request-headers'] as string) ?? 'content-type',
      )
      reply.raw.statusCode = 204
      reply.raw.end()
      return
    }

    return toNodeHandler(auth)(request.raw, reply.raw)
  })
}
