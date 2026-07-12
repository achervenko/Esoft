import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, username } from 'better-auth/plugins';
import { AuthLoginService } from './auth-login.service';
import { createPrismaClientOptions } from '../prisma/prisma-client-options';

const prisma = new PrismaClient(createPrismaClientOptions());
const authLoginService = new AuthLoginService(prisma);

export const auth = betterAuth({
  appName: 'Esoft',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://127.0.0.1:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await authLoginService
            .recordSuccessfulLogin(session)
            .catch((error) => {
              console.error(
                '[auth-login] Failed to update last login timestamp',
                error,
              );
            });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
    admin({
      defaultRole: 'operator',
      adminRoles: ['admin'],
    }),
  ],
});

export type Auth = typeof auth;
