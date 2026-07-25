import { Logger } from '@nestjs/common';
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
import { getFrontendOrigins } from '../config/frontend-origins';
import { loadRootConfig } from '../config/root-environment';
import { prismaService } from '../prisma/prisma.service';

const config = loadRootConfig();

const betterAuthSecret = config.auth.secret;
const resolvedBetterAuthUrl = config.auth.url;
const trustedOrigins = getFrontendOrigins(config);

const prisma = prismaService;
const authLoginService = new AuthLoginService(prisma);
const logger = new Logger('Auth');

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
              logger.error(
                '[auth-login] Failed to update last login timestamp',
                error instanceof Error ? error.stack : String(error),
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
