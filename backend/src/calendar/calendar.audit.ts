import type { AuditFieldChange } from '../audit/audit.types';
import type { CalendarDayResponse } from './calendar.types';

const CALENDAR_AUDIT_FIELDS = {
  holiday: 'Праздник',
  holidayName: 'Название праздника',
  preholiday: 'Предпраздничный день',
  workingDay: 'Рабочий день',
  workingHours: 'Рабочие часы',
} as const;

export function getCalendarWorkdayAuditChanges(params: {
  newValue: CalendarDayResponse;
  oldValue: CalendarDayResponse;
}): AuditFieldChange[] {
  return [
    createAuditFieldChange(
      CALENDAR_AUDIT_FIELDS.workingDay,
      params.oldValue.isWorkingDay,
      params.newValue.isWorkingDay,
    ),
    createAuditFieldChange(
      CALENDAR_AUDIT_FIELDS.holiday,
      params.oldValue.isHoliday,
      params.newValue.isHoliday,
    ),
    createAuditFieldChange(
      CALENDAR_AUDIT_FIELDS.preholiday,
      params.oldValue.isPreholiday,
      params.newValue.isPreholiday,
    ),
    createAuditFieldChange(
      CALENDAR_AUDIT_FIELDS.holidayName,
      params.oldValue.holidayName,
      params.newValue.holidayName,
    ),
    createAuditFieldChange(
      CALENDAR_AUDIT_FIELDS.workingHours,
      params.oldValue.workingHours,
      params.newValue.workingHours,
    ),
  ].filter((field) => field.oldValue !== field.newValue);
}

function createAuditFieldChange(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
): AuditFieldChange {
  return { fieldName, newValue, oldValue };
}
