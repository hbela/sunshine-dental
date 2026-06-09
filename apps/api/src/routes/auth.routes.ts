import { FastifyPluginAsync } from 'fastify'
import { auth } from '../lib/auth.js'

/**
 * Mount better-auth via its Web-standard `auth.handler`, reconstructing a
 * `Request` from Fastify's already-parsed body. (Using better-auth's
 * toNodeHandler against `reply.raw` deadlocks here because Fastify has already
 * drained the request stream when parsing the JSON body.) Responding through
 * `reply.send` also lets @fastify/cors apply CORS headers normally.
 */
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ['GET', 'POST'],
    url: '/*',
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`)

      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (!value) continue
        if (key === 'content-length') continue // recomputed from the rebuilt body
        headers.append(key, Array.isArray(value) ? value.join(',') : value.toString())
      }

      const hasBody = request.method !== 'GET' && request.body != null
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        body: hasBody ? JSON.stringify(request.body) : undefined,
      })

      const response = await auth.handler(req)

      reply.status(response.status)
      const setCookies =
        (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return
        reply.header(key, value)
      })
      if (setCookies.length) reply.header('set-cookie', setCookies)

      return reply.send(response.body ? await response.text() : null)
    },
  })
}
