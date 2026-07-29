import { Injectable } from '@nestjs/common';
import { CalendarRepository } from './calendar.repository';
import { toCalendarDayResponse } from './calendar.presenter';
import type {
  CalendarDayRecord,
  CalendarDayRecordWithWorkday,
} from './calendar.select';
import { daysBetween, formatCalendarDate } from './calendar.date';
import { throwCalendarConflict } from './calendar.errors';
import { CalendarWorkdayWriterService } from './calendar.workday-writer.service';
import type {
  CalendarIntegrityReport,
  CalendarRangeResponse,
  CalendarWorkdayUpdate,
} from './calendar.types';

@Injectable()
export class CalendarService {
  constructor(
    private readonly repository: CalendarRepository,
    private readonly workdayWriter: CalendarWorkdayWriterService,
  ) {}

  async getDay(date: Date) {
    const record = await this.repository.findDay(date);

    this.assertCalendarDayRecord(record);

    return toCalendarDayResponse(record);
  }

  async getRange(dateFrom: Date, dateTo: Date): Promise<CalendarRangeResponse> {
    const records = await this.repository.findRange(dateFrom, dateTo);
    const expectedDays = daysBetween(dateFrom, dateTo) + 1;

    if (records.length !== expectedDays) {
      this.throwCalendarDamaged();
    }

    this.assertCalendarDayRecords(records);

    return {
      days: records.map((record) => toCalendarDayResponse(record)),
    };
  }

  async updateWorkday(update: CalendarWorkdayUpdate, userId?: string | null) {
    return this.workdayWriter.updateWorkday(update, userId);
  }

  async validateIntegrity(): Promise<CalendarIntegrityReport> {
    const report = await this.repository.validateIntegrity();

    return {
      ...report,
      holes: report.holes.map((hole) => formatCalendarDate(hole)),
    };
  }

  async assertIntegrity(): Promise<CalendarIntegrityReport> {
    const report = await this.validateIntegrity();

    if (!report.isValid) {
      this.throwCalendarDamaged();
    }

    return report;
  }

  private assertCalendarDayRecord(
    record: CalendarDayRecord | null,
  ): asserts record is CalendarDayRecordWithWorkday {
    if (!record || !record.workday) {
      this.throwCalendarDamaged();
    }
  }

  private assertCalendarDayRecords(
    records: CalendarDayRecord[],
  ): asserts records is CalendarDayRecordWithWorkday[] {
    if (records.some((record) => !record.workday)) {
      this.throwCalendarDamaged();
    }
  }

  private throwCalendarDamaged(): never {
    throwCalendarConflict('CALENDAR_DAMAGED', 'Календарь поврежден.');
  }
}
