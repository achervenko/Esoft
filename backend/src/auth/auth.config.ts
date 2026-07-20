import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, username } from 'better-auth/plugins';
import { AuthLoginService } from './auth-login.service';
import {
  ac,
  adminRole,
  auditorRole,
  chiefEngineerRole,
  engineerRole,
  operatorRole,
} from './better-auth-access';
import { createPrismaClientOptions } from '../prisma/prisma-client-options';

const isProduction = process.env.NODE_ENV === 'production';
const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim();
const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();
const frontendUrl = process.env.FRONTEND_URL?.trim();

const allowedUrlProtocols = ['http:', 'https:'];

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const validateHttpOrigin = (value: string, name: string) => {
  try {
    const url = new URL(value);

    if (
      !allowedUrlProtocols.includes(url.protocol) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }

    return url.origin;
  } catch {
    throw new Error(
      `${name} must be a valid HTTP(S) origin without path, query or hash`,
    );
  }
};

if (!betterAuthSecret) {
  throw new Error('BETTER_AUTH_SECRET is required');
}

if (isProduction && !betterAuthUrl) {
  throw new Error('BETTER_AUTH_URL is required in production');
}

if (isProduction && !frontendUrl) {
  throw new Error('FRONTEND_URL is required in production');
}

const resolvedBetterAuthUrl = validateHttpOrigin(
  betterAuthUrl ?? 'http://127.0.0.1:3000',
  'BETTER_AUTH_URL',
);
const resolvedFrontendOrigin = validateHttpOrigin(
  frontendUrl ?? 'http://127.0.0.1:5173',
  'FRONTEND_URL',
);

const trustedOrigins = Array.from(
  new Set(
    [
      resolvedFrontendOrigin,
      !isProduction ? 'http://localhost:5173' : undefined,
      !isProduction ? 'http://127.0.0.1:5173' : undefined,
    ].filter(isDefined),
  ),
);

const prisma = new PrismaClient(createPrismaClientOptions());
const authLoginService = new AuthLoginService(prisma);

export const auth = betterAuth({
  appName: 'Esoft',
  baseURL: resolvedBetterAuthUrl,
  secret: betterAuthSecret,
  trustedOrigins,
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
    disableSignUp: true,
  },
  plugins: [
    username(),
    admin({
      ac,
      roles: {
        admin: adminRole,
        operator: operatorRole,
        auditor: auditorRole,
        chief_engineer: chiefEngineerRole,
        engineer: engineerRole,
      },
      defaultRole: 'operator',
      adminRoles: ['admin'],
    }),
  ],
});

export type Auth = typeof auth;
