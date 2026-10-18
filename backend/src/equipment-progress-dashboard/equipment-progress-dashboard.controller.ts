import { EQUIPMENT_PERMISSIONS } from '../equipment/equipment.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { EquipmentProgressDashboardService } from './equipment-progress-dashboard.service';

@Controller('api/dashboard/equipment-progress')
export class EquipmentProgressDashboardController {
  constructor(
    private readonly dashboardService: EquipmentProgressDashboardService,
  ) {}

  @Get()
  @RequirePermission(EQUIPMENT_PERMISSIONS.PROGRESS_READ)
  getProgress(@Session() session: UserSession<Auth>) {
    void session;

    return this.dashboardService.getProgress();
  }
}
