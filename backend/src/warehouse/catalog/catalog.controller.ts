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
import { WarehouseCatalogService } from './catalog.service';

@Controller('api/warehouse/items')
export class WarehouseCatalogController {
  constructor(private readonly catalog: WarehouseCatalogService) {}

  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.CATALOG_MANAGE)
  list(@Query() query: unknown) {
    return this.catalog.list(query);
  }

  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.CATALOG_MANAGE)
  findOne(@Param('id') id: string) {
    return this.catalog.findOne(id);
  }

  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.CATALOG_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.catalog.create(body, session.user.id);
  }

  @Patch(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.CATALOG_MANAGE)
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.update(id, body, session.user.id);
  }

  @Patch(':id/status')
  @RequirePermission(WAREHOUSE_PERMISSIONS.CATALOG_MANAGE)
  setStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.catalog.setStatus(id, body, session.user.id);
  }
}
