import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MachineApiKeysService } from './machine-api-keys.service';

@Module({
  imports: [PrismaModule],
  providers: [MachineApiKeysService],
  exports: [MachineApiKeysService],
})
export class MachineApiKeysModule {}
