import { Module } from '@nestjs/common';
import {
  AuthModule as BetterAuthModule,
  AuthGuard,
  AuthService,
} from '@thallesp/nestjs-better-auth';
import { createAuth } from './auth.config';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { APP_GUARD, Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AUTHENTICATE_REQUEST, PermissionsGuard } from './permissions.guard';
import {
  ActiveModulesModule,
  ACTIVE_MODULES,
} from '../config/active-modules.module';

@Module({
  imports: [
    ActiveModulesModule,
    BetterAuthModule.forRootAsync({
      disableGlobalAuthGuard: true,
      imports: [PrismaModule, ActiveModulesModule],
      inject: [PrismaService, ACTIVE_MODULES],
      useFactory: (
        prisma: PrismaService,
        activeModules: readonly string[],
      ) => ({
        auth: createAuth(prisma, activeModules),
        bodyParser: {
          json: { limit: '2mb' },
          urlencoded: { limit: '2mb', extended: true },
        },
      }),
    }),
  ],
  exports: [BetterAuthModule],
  providers: [
    {
      provide: AUTHENTICATE_REQUEST,
      inject: [Reflector, AuthService],
      useFactory: (reflector: Reflector, service: AuthService) => {
        const guard = new AuthGuard(reflector, { auth: service.instance });
        return (context: ExecutionContext) => guard.canActivate(context);
      },
    },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppAuthModule {}
