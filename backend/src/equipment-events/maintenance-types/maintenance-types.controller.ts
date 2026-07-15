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
import type { Auth } from '../../auth/auth.config';
import { assertAdmin } from '../../auth/role-permissions';
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
  constructor(private readonly maintenanceTypesService: MaintenanceTypesService) {}

  @Get()
  getTypes(
    @Query() query: MaintenanceTypesQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    const { includeInactive } = parseMaintenanceTypesQuery(query);

    if (includeInactive) {
      assertAdmin(session.user.role);
    }

    return this.maintenanceTypesService.getTypes(includeInactive);
  }

  @Post()
  createType(
    @Body() dto: CreateMaintenanceTypeDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.maintenanceTypesService.createType(
      parseCreateMaintenanceTypeDto(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  updateType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaintenanceTypeDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.maintenanceTypesService.updateType(
      id,
      parseUpdateMaintenanceTypeDto(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  activateType(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.maintenanceTypesService.activateType(id, session.user.id);
  }

  @Post(':id/deactivate')
  deactivateType(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.maintenanceTypesService.deactivateType(id, session.user.id);
  }
}
