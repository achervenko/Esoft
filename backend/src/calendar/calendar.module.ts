import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarController } from './calendar.controller';
import { CalendarRepository } from './calendar.repository';
import { CalendarService } from './calendar.service';
import { CalendarWorkdayWriterService } from './calendar.workday-writer.service';

@Module({
  controllers: [CalendarController],
  imports: [AuditModule, PrismaModule],
  providers: [CalendarRepository, CalendarService, CalendarWorkdayWriterService],
  exports: [CalendarService],
})
export class CalendarModule {}
