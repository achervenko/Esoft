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
import { assertCanManageEquipmentEvents } from '../auth/role-permissions';
import { EquipmentEventsService } from './equipment-events.service';
import {
  type CreateManualEquipmentEventDto,
  type EquipmentEventsQueryDto,
  type UpdateCreatedEquipmentEventDto,
  parseCreateManualEventDto,
  parseEquipmentEventsQuery,
  parseUpdateCreatedEventDto,
} from './equipment-events.validation';

@Controller('api')
export class EquipmentEventsController {
  constructor(
    private readonly equipmentEventsService: EquipmentEventsService,
  ) {}

  @Get('equipment-events')
  findAll(
    @Query() query: EquipmentEventsQueryDto,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.equipmentEventsService.findAll(
      parseEquipmentEventsQuery(query),
    );
  }

  @Get('equipment-events/responsible-users')
  findResponsibleUsers(@Session() session: UserSession<Auth>) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.findResponsibleUsers();
  }

  @Get('equipment-events/:id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.equipmentEventsService.findOne(id);
  }

  @Post('equipment/:visibleId/events/manual')
  createManual(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Body() dto: CreateManualEquipmentEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.createManual(
      parseCreateManualEventDto(dto, visibleId),
      session.user.id,
    );
  }

  @Patch('equipment-events/:id')
  updateCreated(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreatedEquipmentEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.updateCreated(
      id,
      parseUpdateCreatedEventDto(dto),
      session.user.id,
    );
  }

  @Post('equipment-events/:id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.cancel(id, session.user.id);
  }
}
