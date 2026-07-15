import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdentityNumberingService } from './identity-numbering.service';

@Module({
  imports: [PrismaModule],
  providers: [IdentityNumberingService],
  exports: [IdentityNumberingService],
})
export class NumberingModule {}
