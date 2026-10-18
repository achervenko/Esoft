import { ParsePositiveIntPipe } from '../application/pipes/parse-positive-int.pipe';
import { EVENTS_PERMISSIONS } from './events.permissions';
import { RequirePermission } from '../auth/require-permission';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
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
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  create(
    @Body() dto: CreateEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['create']> {
    return this.eventsService.create(
      parseCreateEventDto(dto, this.extensionRegistry),
      session.user.id,
    );
  }

  @Get('events')
  @RequirePermission(EVENTS_PERMISSIONS.READ)
  findAll(
    @Query() query: EventsListQueryDto | undefined,
  ): ReturnType<EventsService['findAll']> {
    return this.eventsService.findAll(
      parseEventsListQueryDto(query, this.extensionRegistry),
    );
  }

  @Get('events/responsible-users')
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  findResponsibleUsers(): ReturnType<EventsService['findResponsibleUsers']> {
    return this.eventsService.findResponsibleUsers();
  }

  @Get('events/:id')
  @RequirePermission(EVENTS_PERMISSIONS.READ)
  findOne(
    @Param('id', ParsePositiveIntPipe) id: number,
  ): ReturnType<EventsService['findOne']> {
    return this.eventsService.findOne(id);
  }

  @Patch('events/:id')
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  updateCreated(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateCreatedEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['updateCreated']> {
    return this.eventsService.updateCreated(
      id,
      parseUpdateCreatedEventDto(dto, this.extensionRegistry),
      session.user.id,
    );
  }

  @Post('events/:id/start')
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  start(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: StartEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['start']> {
    return this.eventsService.start(
      id,
      parseStartEventDto(dto),
      session.user.id,
    );
  }

  @Post('events/:id/complete')
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  complete(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CompleteEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['complete']> {
    return this.eventsService.complete(
      id,
      parseCompleteEventDto(dto),
      session.user.id,
    );
  }

  @Post('events/:id/cancel')
  @RequirePermission(EVENTS_PERMISSIONS.MANAGE)
  cancel(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CancelEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ): ReturnType<EventsService['cancel']> {
    return this.eventsService.cancel(
      id,
      parseCancelEventDto(dto),
      session.user.id,
    );
  }
}
