import Fastify from 'fastify'
import { app } from './app.js'
import { tryUnlockFromEnv } from './lib/crypto.js'

// Dev convenience only: arm the keyring from ENCRYPTION_KEY (refused in
// production unless ALLOW_ENV_KEY=true). In prod the server boots locked and
// an ADMIN unlocks via POST /api/admin/unlock.
tryUnlockFromEnv()

const server = Fastify({ logger: true })

server.register(app)

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`Server listening at http://localhost:${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}
start()
