import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarController } from './calendar.controller';
import { CalendarRepository } from './calendar.repository';
import { CalendarService } from './calendar.service';
import { CalendarWorkdayWriterService } from './calendar.workday-writer.service';
import { CalendarEngineService } from './engine/calendar-engine.service';
import { CalendarSourceResolver } from './engine/calendar-source.resolver';
import { EquipmentEventsProvider } from './engine/equipment-events.provider';
import { ProductionCalendarProvider } from './engine/production-calendar.provider';

@Module({
  controllers: [CalendarController],
  imports: [AuditModule, EventsModule, PrismaModule],
  providers: [
    CalendarEngineService,
    CalendarRepository,
    CalendarService,
    CalendarSourceResolver,
    CalendarWorkdayWriterService,
    EquipmentEventsProvider,
    ProductionCalendarProvider,
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
