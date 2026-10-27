import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseReceiptsService } from './receipts.service';
import { WarehouseReceiptsQueryService } from './receipts-query.service';
@Controller('api/warehouse/receipts')
export class WarehouseReceiptsController {
  constructor(
    private readonly receipts: WarehouseReceiptsService,
    private readonly queries: WarehouseReceiptsQueryService,
  ) {}
  @Post()
  @RequirePermission(WAREHOUSE_PERMISSIONS.RECEIPTS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.receipts.createManual(body, session.user.id);
  }
  @Get()
  @RequirePermission(WAREHOUSE_PERMISSIONS.RECEIPTS_READ)
  list(@Query() query: unknown) {
    return this.queries.list(query);
  }
  @Get(':id')
  @RequirePermission(WAREHOUSE_PERMISSIONS.RECEIPTS_READ)
  findOne(@Param('id') id: string) {
    return this.receipts.findOne(id);
  }
}
