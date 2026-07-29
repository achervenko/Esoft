import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, CalendarSource } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { CalendarRepository } from './calendar.repository';
import { getCalendarWorkdayAuditChanges } from './calendar.audit';
import {
  toCalendarDayResponse,
  type CalendarPresentedDay,
} from './calendar.presenter';
import type {
  CalendarDayRecord,
  CalendarDayRecordWithWorkday,
} from './calendar.select';
import { DEFAULT_WORKING_HOURS } from './calendar.constants';
import { throwCalendarConflict } from './calendar.errors';
import { isWorkingHoursValidForWorkday } from './calendar.workday-rules';
import type {
  CalendarDayResponse,
  CalendarWorkdayData,
  CalendarWorkdayUpdate,
} from './calendar.types';

@Injectable()
export class CalendarWorkdayWriterService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly repository: CalendarRepository,
  ) {}

  async updateWorkday(
    update: CalendarWorkdayUpdate,
    userId?: string | null,
  ): Promise<CalendarDayResponse> {
    return this.repository.transaction(async (tx) => {
      const currentRecord = await this.repository.findDay(update.date, tx);

      this.assertCalendarDayRecord(currentRecord);

      const current = toCalendarDayResponse(currentRecord);
      const workday = this.buildWorkdayPatch(update, current);
      const updatedRecord = await this.repository.updateWorkday(
        update.date,
        workday,
        tx,
      );

      this.assertCalendarDayRecord(updatedRecord);

      const updated = toCalendarDayResponse(updatedRecord);
      const fields = getCalendarWorkdayAuditChanges({
        newValue: updated,
        oldValue: current,
      });

      await this.auditLog.writeFieldChanges({
        action: AuditAction.UPDATE,
        entityStringId: current.date,
        entityType: 'calendar_workday',
        fields,
        module: AuditModule.CALENDAR,
        tx,
        userId,
      });

      return updated;
    });
  }

  private buildWorkdayPatch(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): CalendarWorkdayData {
    const isWorkingDay = this.resolveWorkingDay(update, current);
    const workingHours = this.resolveWorkingHours(update, current);

    this.assertWorkingHoursMatchWorkingDay(isWorkingDay, workingHours);

    return {
      holidayName: this.resolveHolidayName(update, current),
      isHoliday: this.resolveHoliday(update, current),
      isPreholiday: this.resolvePreholiday(update, current),
      isWorkingDay,
      source: this.resolveSource(update),
      workingHours,
    };
  }

  private resolveWorkingDay(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): boolean {
    return update.isWorkingDay ?? current.isWorkingDay;
  }

  private resolveWorkingHours(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): number {
    if (update.workingHours !== undefined) {
      return update.workingHours;
    }

    if (update.isWorkingDay === false) {
      return 0;
    }

    if (update.isWorkingDay === true && current.workingHours === 0) {
      return DEFAULT_WORKING_HOURS;
    }

    return current.workingHours;
  }

  private resolveHolidayName(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): string | null {
    return update.holidayName === undefined
      ? current.holidayName
      : update.holidayName;
  }

  private resolveHoliday(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): boolean {
    return update.isHoliday ?? current.isHoliday;
  }

  private resolvePreholiday(
    update: CalendarWorkdayUpdate,
    current: CalendarPresentedDay,
  ): boolean {
    return update.isPreholiday ?? current.isPreholiday;
  }

  private resolveSource(update: CalendarWorkdayUpdate): CalendarSource {
    return update.source ?? CalendarSource.MANUAL;
  }

  private assertWorkingHoursMatchWorkingDay(
    isWorkingDay: boolean,
    workingHours: number,
  ): void {
    if (isWorkingHoursValidForWorkday(isWorkingDay, workingHours)) {
      return;
    }

    if (isWorkingDay) {
      throwCalendarConflict(
        'WORKING_HOURS_INVALID',
        'Для рабочего дня укажите положительную продолжительность.',
      );
    }

    throwCalendarConflict(
      'WORKING_HOURS_INVALID',
      'Для нерабочего дня продолжительность должна быть 0.',
    );
  }

  private assertCalendarDayRecord(
    record: CalendarDayRecord | null,
  ): asserts record is CalendarDayRecordWithWorkday {
    if (!record || !record.workday) {
      throwCalendarConflict('CALENDAR_DAMAGED', 'Календарь поврежден.');
    }
  }
}
