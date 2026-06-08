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
    // defaultRole must be a valid value of our Prisma `Role` enum (not the
    // plugin's built-in "user"); ADMIN is recognised as the privileged role.
    admin({ defaultRole: 'ASSISTANT', adminRoles: ['ADMIN'] }),
    openAPI()
  ],
  trustedOrigins: ['http://localhost:5173'],
})
