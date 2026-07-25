import { Module } from '@nestjs/common';
import { PrismaService, prismaService } from './prisma.service';

@Module({
  exports: [PrismaService],
  providers: [
    {
      provide: PrismaService,
      useValue: prismaService,
    },
  ],
})
export class PrismaModule {}
