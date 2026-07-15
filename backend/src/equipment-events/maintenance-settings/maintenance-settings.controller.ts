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
  type CreateMaintenanceSettingDto,
  type UpdateMaintenanceSettingDto,
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

  @Get('available-types')
  getAvailableMaintenanceTypes(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Session() _session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.getAvailableMaintenanceTypes(
      visibleId,
    );
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

  @Patch(':settingId')
  updateSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('settingId', ParseIntPipe) settingId: number,
    @Body() dto: UpdateMaintenanceSettingDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.updateSetting(
      visibleId,
      settingId,
      parseUpdateMaintenanceSettingDto(dto),
      session.user.id,
    );
  }

  @Delete(':settingId')
  deleteSetting(
    @Param('visibleId', ParseIntPipe) visibleId: number,
    @Param('settingId', ParseIntPipe) settingId: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageEquipmentEvents(session.user.role);

    return this.maintenanceSettingsService.deleteSetting(
      visibleId,
      settingId,
      session.user.id,
    );
  }
}
