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
  type CompleteEquipmentEventDto,
  type CreateManualEquipmentEventDto,
  type EquipmentEventsQueryDto,
  type UpdateDraftEquipmentEventDto,
  parseCompleteEventDto,
  parseCreateManualEventDto,
  parseEquipmentEventsQuery,
  parseUpdateDraftEventDto,
} from './equipment-events.validation';

@Controller('api/equipment-events')
export class EquipmentEventsController {
  constructor(private readonly equipmentEventsService: EquipmentEventsService) {}

  @Get()
  findAll(
    @Query() query: EquipmentEventsQueryDto,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.equipmentEventsService.findAll(parseEquipmentEventsQuery(query));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.equipmentEventsService.findOne(id);
  }

  @Post('manual')
  createManual(
    @Body() dto: CreateManualEquipmentEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.createManual(
      parseCreateManualEventDto(dto),
      session.user.id,
    );
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteEquipmentEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.complete(
      id,
      parseCompleteEventDto(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDraftEquipmentEventDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.updateDraft(
      id,
      parseUpdateDraftEventDto(dto),
      session.user.id,
    );
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.equipmentEventsService.cancel(id, session.user.id);
  }
}
