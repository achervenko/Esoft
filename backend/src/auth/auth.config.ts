import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { roleAwarePrismaAdapter } from './role-aware-prisma-adapter';
import { admin, username, customSession } from 'better-auth/plugins';
import { withEffectiveRoles } from './effective-session';
import { AuthLoginService } from './auth-login.service';
import {
  ac,
  adminRole,
  auditorRole,
  chiefEngineerRole,
  engineerRole,
  operatorRole,
  ppeSpecialistRole,
  accountingSpecialistRole,
  storekeeperRole,
} from './better-auth-access';
import { getFrontendOrigins } from '../config/frontend-origins';
import { loadRootConfig } from '../config/root-environment';
import { loadActiveModules } from '../config/active-modules.module';
import {
  createRoleAvailabilityHooks,
  createRoleRequestHook,
} from './role-availability.hooks';
import { prismaService } from '../prisma/prisma.service';

const config = loadRootConfig();
const activeModules = loadActiveModules();

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
  database: roleAwarePrismaAdapter(prisma, activeModules),
  hooks: { before: createRoleRequestHook() },
  databaseHooks: {
    ...createRoleAvailabilityHooks(activeModules),
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
    customSession((value) =>
      Promise.resolve(withEffectiveRoles(value, activeModules)),
    ),
    username(),
    admin({
      ac,
      roles: {
        admin: adminRole,
        operator: operatorRole,
        auditor: auditorRole,
        chief_engineer: chiefEngineerRole,
        engineer: engineerRole,
        ppe_specialist: ppeSpecialistRole,
        accounting_specialist: accountingSpecialistRole,
        storekeeper: storekeeperRole,
      },
      defaultRole: 'operator',
      adminRoles: ['admin'],
    }),
  ],
});

export type Auth = typeof auth;
