import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
import { EQUIPMENT_PERMISSIONS } from '../../equipment/equipment.permissions';
import { RequirePermission } from '../../auth/require-permission';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
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
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  getSettings(@Param('visibleId', ParsePositiveIntPipe) visibleId: number) {
    return this.maintenanceSettingsService.getSettings(visibleId);
  }

  @Get('available-types')
  @RequirePermission(EQUIPMENT_PERMISSIONS.READ)
  getAvailableMaintenanceTypes(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
  ) {
    return this.maintenanceSettingsService.getAvailableMaintenanceTypes(
      visibleId,
    );
  }

  @Post()
  @RequirePermission(EQUIPMENT_PERMISSIONS.EVENTS_MANAGE)
  createSetting(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Body() dto: CreateMaintenanceSettingDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.createSetting(
      visibleId,
      parseCreateMaintenanceSettingDto(dto),
      session.user.id,
    );
  }

  @Patch(':settingId')
  @RequirePermission(EQUIPMENT_PERMISSIONS.EVENTS_MANAGE)
  updateSetting(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('settingId', ParsePositiveIntPipe) settingId: number,
    @Body() dto: UpdateMaintenanceSettingDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.updateSetting(
      visibleId,
      settingId,
      parseUpdateMaintenanceSettingDto(dto),
      session.user.id,
    );
  }

  @Delete(':settingId')
  @RequirePermission(EQUIPMENT_PERMISSIONS.EVENTS_MANAGE)
  deleteSetting(
    @Param('visibleId', ParsePositiveIntPipe) visibleId: number,
    @Param('settingId', ParsePositiveIntPipe) settingId: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceSettingsService.deleteSetting(
      visibleId,
      settingId,
      session.user.id,
    );
  }
}
