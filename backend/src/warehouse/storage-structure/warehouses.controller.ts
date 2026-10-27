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
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehousesService } from './warehouses.service';

@Controller('api/warehouse/warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_READ)
  list(@Query() query: unknown) {
    return this.warehouses.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_READ)
  findOne(@Param('id') id: string) {
    return this.warehouses.findOne(id);
  }
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.warehouses.create(body, session.user.id);
  }
  @Patch(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.warehouses.update(id, body, session.user.id);
  }
}
