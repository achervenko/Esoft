import { CalendarSource, PrismaClient } from '@prisma/client';
import {
  CALENDAR_END_DATE,
  CALENDAR_START_DATE,
  DEFAULT_WORKING_HOURS,
} from './calendar.constants';

type CalendarGenerationClient = {
  $executeRaw: PrismaClient['$executeRaw'];
};

export async function generateDefaultCalendar(
  prisma: CalendarGenerationClient,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO calendar_days (
      date,
      year,
      quarter,
      month,
      week,
      iso_week_year,
      day,
      day_of_week,
      day_of_year,
      updated_at
    )
    SELECT
      d::date AS date,
      EXTRACT(YEAR FROM d)::smallint AS year,
      EXTRACT(QUARTER FROM d)::smallint AS quarter,
      EXTRACT(MONTH FROM d)::smallint AS month,
      EXTRACT(WEEK FROM d)::smallint AS week,
      EXTRACT(ISOYEAR FROM d)::smallint AS iso_week_year,
      EXTRACT(DAY FROM d)::smallint AS day,
      EXTRACT(ISODOW FROM d)::smallint AS day_of_week,
      EXTRACT(DOY FROM d)::smallint AS day_of_year,
      CURRENT_TIMESTAMP AS updated_at
    FROM generate_series(
      ${CALENDAR_START_DATE}::date,
      ${CALENDAR_END_DATE}::date,
      INTERVAL '1 day'
    ) AS generated_days(d)
    ON CONFLICT (date) DO NOTHING
  `;

  await prisma.$executeRaw`
    INSERT INTO calendar_workdays (
      calendar_day_id,
      is_working_day,
      is_holiday,
      is_preholiday,
      holiday_name,
      working_hours,
      source,
      updated_at
    )
    WITH default_workdays AS (
      SELECT
        calendar_days.id AS calendar_day_id,
        EXTRACT(ISODOW FROM calendar_days.date)::int BETWEEN 1 AND 5 AS is_working_day
      FROM calendar_days
      WHERE calendar_days.date BETWEEN ${CALENDAR_START_DATE}::date
        AND ${CALENDAR_END_DATE}::date
    )
    SELECT
      default_workdays.calendar_day_id,
      default_workdays.is_working_day,
      false AS is_holiday,
      false AS is_preholiday,
      NULL AS holiday_name,
      CASE
        WHEN default_workdays.is_working_day THEN ${DEFAULT_WORKING_HOURS}
        ELSE 0.00
      END AS working_hours,
      ${CalendarSource.SYSTEM}::calendar_source AS source,
      CURRENT_TIMESTAMP AS updated_at
    FROM default_workdays
    ON CONFLICT (calendar_day_id) DO NOTHING
  `;
}
