import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { RequirePermission } from '../../auth/require-permission';
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
import { WarehouseStorageLocationsService } from './storage-locations.service';

@Controller('api/warehouse/storage-locations')
export class WarehouseStorageLocationsController {
  constructor(
    private readonly storageLocations: WarehouseStorageLocationsService,
  ) {}

  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_READ)
  list(@Query() query: unknown) {
    return this.storageLocations.list(query);
  }

  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_READ)
  findOne(@Param('id') id: string) {
    return this.storageLocations.findOne(id);
  }

  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.storageLocations.create(body, session.user.id);
  }

  @Patch(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.STORAGE_LOCATIONS_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.storageLocations.update(id, body, session.user.id);
  }
}
