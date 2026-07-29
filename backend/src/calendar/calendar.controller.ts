import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertCanAccessCalendar } from '../auth/role-permissions';
import { CalendarService } from './calendar.service';
import {
  parseCalendarDayQuery,
  parseCalendarRangeQuery,
  parseCalendarWorkdayUpdateDto,
} from './calendar.validation';
import type { CalendarDayQueryDto } from './dto/calendar-day-query.dto';
import type { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import type { CalendarWorkdayUpdateDto } from './dto/calendar-workday-update.dto';
import type {
  CalendarDayResponse,
  CalendarRangeResponse,
} from './calendar.types';

@Controller('api')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('calendar/day')
  findDay(
    @Query() query: CalendarDayQueryDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarDayResponse> {
    assertCanAccessCalendar(session.user.role);

    return this.calendarService.getDay(parseCalendarDayQuery(query));
  }

  @Get('calendar/range')
  findRange(
    @Query() query: CalendarRangeQueryDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarRangeResponse> {
    assertCanAccessCalendar(session.user.role);

    const parsedQuery = parseCalendarRangeQuery(query);

    return this.calendarService.getRange(
      parsedQuery.dateFrom,
      parsedQuery.dateTo,
    );
  }

  @Patch('calendar/workday')
  updateWorkday(
    @Body() dto: CalendarWorkdayUpdateDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarDayResponse> {
    assertCanAccessCalendar(session.user.role);

    return this.calendarService.updateWorkday(
      parseCalendarWorkdayUpdateDto(dto),
      session.user.id,
    );
  }
}
