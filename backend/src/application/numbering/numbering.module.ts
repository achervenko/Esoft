import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityNumberingService } from './identity-numbering.service';

@Module({
  providers: [IdentityNumberingService, PrismaService],
  exports: [IdentityNumberingService],
})
export class NumberingModule {}
