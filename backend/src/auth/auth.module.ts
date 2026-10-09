import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth.config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ReservedRoleInterceptor } from './reserved-role.interceptor';

@Module({
  imports: [
    BetterAuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '2mb' },
        urlencoded: { limit: '2mb', extended: true },
      },
    }),
  ],
  exports: [BetterAuthModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ReservedRoleInterceptor }],
})
export class AppAuthModule {}
