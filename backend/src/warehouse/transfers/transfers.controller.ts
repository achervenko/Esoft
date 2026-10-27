import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseTransfersService } from './transfers.service';
@Controller('api/warehouse/transfers')
export class WarehouseTransfersController {
  constructor(private readonly transfers: WarehouseTransfersService) {}
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.TRANSFERS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.transfers.create(body, session.user.id);
  }
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.TRANSFERS_READ)
  list(@Query() query: unknown) {
    return this.transfers.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.TRANSFERS_READ)
  findOne(@Param('id') id: string) {
    return this.transfers.findOne(id);
  }
}
