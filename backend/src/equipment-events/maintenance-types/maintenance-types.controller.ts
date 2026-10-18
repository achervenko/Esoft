import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
import { EQUIPMENT_PERMISSIONS } from '../../equipment/equipment.permissions';
import { RequirePermission } from '../../auth/require-permission';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { hasPermission } from '../../auth/permission-policy';
import { MaintenanceTypesService } from './maintenance-types.service';
import {
  type CreateMaintenanceTypeDto,
  type MaintenanceTypesQueryDto,
  type UpdateMaintenanceTypeDto,
  parseCreateMaintenanceTypeDto,
  parseMaintenanceTypesQuery,
  parseUpdateMaintenanceTypeDto,
} from './maintenance-types.validation';

@Controller('api/maintenance-types')
export class MaintenanceTypesController {
  constructor(
    private readonly maintenanceTypesService: MaintenanceTypesService,
  ) {}

  @Get()
  @RequirePermission(EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_READ)
  getTypes(
    @Query() query: MaintenanceTypesQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    const { includeInactive } = parseMaintenanceTypesQuery(query);

    if (
      includeInactive &&
      !hasPermission(
        session.user.role,
        EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE,
      )
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Недостаточно прав для просмотра неактивных видов обслуживания.',
      });
    }

    return this.maintenanceTypesService.getTypes(includeInactive);
  }

  @Post()
  @RequirePermission(EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE)
  createType(
    @Body() dto: CreateMaintenanceTypeDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceTypesService.createType(
      parseCreateMaintenanceTypeDto(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  @RequirePermission(EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE)
  updateType(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateMaintenanceTypeDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceTypesService.updateType(
      id,
      parseUpdateMaintenanceTypeDto(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  @RequirePermission(EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE)
  activateType(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceTypesService.activateType(id, session.user.id);
  }

  @Post(':id/deactivate')
  @RequirePermission(EQUIPMENT_PERMISSIONS.MAINTENANCE_TYPES_MANAGE)
  deactivateType(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.maintenanceTypesService.deactivateType(id, session.user.id);
  }
}
