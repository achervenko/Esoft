import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import {
  assertCanManageEvents,
  assertCanViewEvents,
} from '../auth/role-permissions';
import { EventsService } from './events.service';
import { parseCreateEventDto } from './events-create.validation';
import { parseUpdateCreatedEventDto } from './events-update.validation';
import {
  parseCancelEventDto,
  parseCompleteEventDto,
  parseStartEventDto,
} from './events.validation';
import { parseEventsListQueryDto } from './events-list.validation';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import type {
  CancelEventDto,
  CompleteEventDto,
  CreateEventDto,
  EventsListQueryDto,
  StartEventDto,
  UpdateCreatedEventDto,
} from './events.validation.types';

@Controller('api')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly extensionRegistry: EventExtensionRegistry,
  ) {}

  @Post('events')
  create(
    @Body() dto: CreateEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['create']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.create(
      parseCreateEventDto(dto, this.extensionRegistry),
      session.user.id,
    );
  }

  @Get('events')
  findAll(
    @Query() query: EventsListQueryDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['findAll']> {
    assertCanViewEvents(session.user.role);

    return this.eventsService.findAll(
      parseEventsListQueryDto(query, this.extensionRegistry),
    );
  }

  @Get('events/responsible-users')
  findResponsibleUsers(
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['findResponsibleUsers']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.findResponsibleUsers();
  }

  @Get('events/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['findOne']> {
    assertCanViewEvents(session.user.role);

    return this.eventsService.findOne(id);
  }

  @Patch('events/:id')
  updateCreated(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreatedEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['updateCreated']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.updateCreated(
      id,
      parseUpdateCreatedEventDto(dto, this.extensionRegistry),
      session.user.id,
    );
  }

  @Post('events/:id/start')
  start(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['start']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.start(
      id,
      parseStartEventDto(dto),
      session.user.id,
    );
  }

  @Post('events/:id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['complete']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.complete(
      id,
      parseCompleteEventDto(dto),
      session.user.id,
    );
  }

  @Post('events/:id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['cancel']> {
    assertCanManageEvents(session.user.role);

    return this.eventsService.cancel(
      id,
      parseCancelEventDto(dto),
      session.user.id,
    );
  }
}
