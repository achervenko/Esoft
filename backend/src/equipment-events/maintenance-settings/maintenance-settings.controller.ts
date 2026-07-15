import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { assertCanManageEquipmentEvents } from '../../auth/role-permissions';
import { MaintenanceSettingsService } from './maintenance-settings.service';
import {
  type CreateMaintenanceEventTypeDto,
  type CreateMaintenanceSettingDto,
  type UpdateMaintenanceSettingDto,
  parseCreateMaintenanceEventTypeDto,
  parseCreateMaintenanceSettingDto,
  parseUpdateMaintenanceSettingDto,
} from './maintenance-settings.validation';

@Controller('api/equipment/:visibleId/maintenance-settings')
export class MaintenanceSettingsController {
  constructor(
    private readonly maintenanceSettingsService: MaintenanceSettingsService,
  ) {}

  @Get()
  getSettings(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.getSettings(visibleId);
  }

  @Get('available-event-types')
  getAvailableEventTypes(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.getAvailableEventTypes(visibleId);
  }

  @Post()
  createSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Body() dto: CreateMaintenanceSettingDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.createSetting(
      visibleId,
      parseCreateMaintenanceSettingDto(dto),
      session.user.id,
    );
  }

  @Patch(':eventTypeId')
  updateSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('eventTypeId', ParseIntPipe) eventTypeId: number,
    @Body() dto: UpdateMaintenanceSettingDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.updateSetting(
      visibleId,
      eventTypeId,
      parseUpdateMaintenanceSettingDto(dto),
      session.user.id,
    );
  }

  @Delete(':eventTypeId')
  deleteSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('eventTypeId', ParseIntPipe) eventTypeId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.deleteSetting(
      visibleId,
      eventTypeId,
      session.user.id,
    );
  }

  @Post('event-types')
  createEventTypeAndSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Body() dto: CreateMaintenanceEventTypeDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.createEventTypeAndSetting(
      visibleId,
      parseCreateMaintenanceEventTypeDto(dto),
      session.user.id,
    );
  }
}
