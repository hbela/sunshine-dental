import { betterAuth } from 'better-auth'
import { prismaAdapter } from '@better-auth/prisma-adapter'
import { admin, openAPI } from 'better-auth/plugins'
import { prisma } from './prisma.js'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    admin(),
    openAPI()
  ],
  trustedOrigins: ['http://localhost:5173'],
})
