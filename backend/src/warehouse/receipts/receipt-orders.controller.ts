import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS as P } from '../warehouse.permissions';
import { WarehouseReceiptsQueryService } from './receipts-query.service';
@Controller('api/warehouse/receipt-orders')
export class WarehouseReceiptOrdersController {
  constructor(private readonly queries: WarehouseReceiptsQueryService) {}
  @Get()
  @RequirePermission(P.RECEIPTS_READ)
  list(@Query() query: unknown) {
    return this.queries.orders(query);
  }
}
