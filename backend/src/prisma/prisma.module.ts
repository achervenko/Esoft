import { Module } from '@nestjs/common';
import { PrismaService, prismaService } from './prisma.service';

@Module({
  exports: [PrismaService],
  providers: [
    {
      provide: PrismaService,
      // Better Auth uses this same instance; Nest owns its runtime lifecycle.
      useValue: prismaService,
    },
  ],
})
export class PrismaModule {}
