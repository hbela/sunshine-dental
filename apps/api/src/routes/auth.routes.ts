import { FastifyPluginAsync } from 'fastify'
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../lib/auth.js'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.all('/*', async (request, reply) => {
    return toNodeHandler(auth)(request.raw, reply.raw)
  })
}
