import { CALENDAR_PERMISSIONS } from './calendar.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { CalendarService } from './calendar.service';
import {
  parseCalendarEngineQuery,
  parseCalendarDayQuery,
  parseCalendarRangeQuery,
  parseCalendarWorkdayUpdateDto,
} from './calendar.validation';
import type { CalendarDayQueryDto } from './dto/calendar-day-query.dto';
import type { CalendarEngineQueryDto } from './dto/calendar-engine-query.dto';
import type { CalendarRangeQueryDto } from './dto/calendar-range-query.dto';
import type { CalendarWorkdayUpdateDto } from './dto/calendar-workday-update.dto';
import type {
  CalendarDayResponse,
  CalendarRangeResponse,
} from './calendar.types';
import { CalendarEngineService } from './engine/calendar-engine.service';
import { CalendarSourceResolver } from './engine/calendar-source.resolver';
import type { CalendarDto } from './engine/calendar-engine.types';

@Controller('api')
export class CalendarController {
  constructor(
    private readonly calendarEngine: CalendarEngineService,
    private readonly calendarService: CalendarService,
    private readonly sourceResolver: CalendarSourceResolver,
  ) {}

  @Get('calendar')
  @RequirePermission(CALENDAR_PERMISSIONS.READ)
  findCalendar(
    @Query() query: CalendarEngineQueryDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarDto> {
    const providers = this.sourceResolver.resolveProviders(session);
    const parsedQuery = parseCalendarEngineQuery(query);

    return this.calendarEngine.buildCalendar({
      dateFrom: parsedQuery.dateFrom,
      dateTo: parsedQuery.dateTo,
      providers,
    });
  }

  @Get('calendar/day')
  @RequirePermission(CALENDAR_PERMISSIONS.MANAGE)
  findDay(
    @Query() query: CalendarDayQueryDto | undefined,
  ): Promise<CalendarDayResponse> {
    return this.calendarService.getDay(parseCalendarDayQuery(query));
  }

  @Get('calendar/range')
  @RequirePermission(CALENDAR_PERMISSIONS.MANAGE)
  findRange(
    @Query() query: CalendarRangeQueryDto | undefined,
  ): Promise<CalendarRangeResponse> {
    const parsedQuery = parseCalendarRangeQuery(query);

    return this.calendarService.getRange(
      parsedQuery.dateFrom,
      parsedQuery.dateTo,
    );
  }

  @Patch('calendar/workday')
  @RequirePermission(CALENDAR_PERMISSIONS.MANAGE)
  updateWorkday(
    @Body() dto: CalendarWorkdayUpdateDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarDayResponse> {
    return this.calendarService.updateWorkday(
      parseCalendarWorkdayUpdateDto(dto),
      session.user.id,
    );
  }

  @Patch('calendar/workday/reset')
  @RequirePermission(CALENDAR_PERMISSIONS.MANAGE)
  resetWorkday(
    @Body() dto: CalendarDayQueryDto | undefined,
    @Session() session: UserSession<Auth>,
  ): Promise<CalendarDayResponse> {
    return this.calendarService.resetWorkday(
      parseCalendarDayQuery(dto),
      session.user.id,
    );
  }
}
