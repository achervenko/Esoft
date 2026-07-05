import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, username } from 'better-auth/plugins';
import { createPrismaClientOptions } from '../prisma/prisma-client-options';

const prisma = new PrismaClient(createPrismaClientOptions());

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
  user: {
    additionalFields: {
      lastName: {
        type: 'string',
        required: false,
        returned: true,
        fieldName: 'last_name',
      },
      firstName: {
        type: 'string',
        required: false,
        returned: true,
        fieldName: 'first_name',
      },
      middleName: {
        type: 'string',
        required: false,
        returned: true,
        fieldName: 'middle_name',
      },
      position: {
        type: 'string',
        required: false,
        returned: true,
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
