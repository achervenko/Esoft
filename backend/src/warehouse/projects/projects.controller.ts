import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseProjectsService } from './projects.service';
@Controller('api/warehouse/projects')
export class WarehouseProjectsController {
  constructor(private readonly projects: WarehouseProjectsService) {}
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.PROJECTS_READ)
  list(@Query() query: unknown) {
    return this.projects.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.PROJECTS_READ)
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }
}
