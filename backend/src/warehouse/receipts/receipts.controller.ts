import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { WAREHOUSE_PERMISSIONS as P } from '../warehouse.permissions';
import { WarehouseReceiptsService } from './receipts.service';
import { WarehouseReceiptsQueryService } from './receipts-query.service';
import { WarehouseReceiptPlacementsService } from './receipt-placements.service';
import { WarehouseReceiptItemMappingService } from './receipt-item-mapping.service';
import { WarehouseReceiptReconciliationService } from './receipt-reconciliation.service';
import { WarehouseReceiptConflictResolutionService } from './receipt-conflict-resolution.service';
@Controller('api/warehouse/receipts')
export class WarehouseReceiptsController {
  constructor(
    private readonly receipts: WarehouseReceiptsService,
    private readonly queries: WarehouseReceiptsQueryService,
    private readonly placements: WarehouseReceiptPlacementsService,
    private readonly itemMapping: WarehouseReceiptItemMappingService,
    private readonly reconciliation: WarehouseReceiptReconciliationService,
    private readonly conflictResolution: WarehouseReceiptConflictResolutionService,
  ) {}
  @Post()
  @RequirePermission(P.RECEIPTS_MANAGE)
  create(@Body() body: unknown, @Session() session: UserSession<Auth>) {
    return this.receipts.createManual(body, session.user.id);
  }
  @Get()
  @RequirePermission(P.RECEIPTS_READ)
  list(@Query() query: unknown) {
    return this.queries.list(query);
  }
  @Get(':id')
  @RequirePermission(P.RECEIPTS_READ)
  findOne(@Param('id') id: string) {
    return this.receipts.findOne(id);
  }
  @Get(':id/reconciliation-candidates')
  @RequirePermission(P.RECEIPTS_READ, P.RECEIPTS_MAP)
  reconciliationCandidates(@Param('id') id: string) {
    return this.queries.reconciliationCandidates(id);
  }
  @Post(':id/cancel')
  @RequirePermission(P.RECEIPTS_MANAGE)
  cancel(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.receipts.cancelManual(id, session.user.id);
  }
  @Post(':id/lines/:lineId/placements')
  @RequirePermission(P.RECEIPTS_PLACE)
  place(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.placements.place(id, lineId, body, session.user.id);
  }
  @Post(':id/lines/:lineId/item-link')
  @RequirePermission(P.RECEIPTS_MAP, P.CATALOG_LINKS_MANAGE)
  mapItem(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.itemMapping.mapItem(id, lineId, body, session.user.id);
  }
  @Post(':id/reconcile')
  @RequirePermission(P.RECEIPTS_MAP)
  reconcile(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.reconciliation.reconcile(id, body, session.user.id);
  }
  @Post(':id/resolve-conflict')
  @RequirePermission('integrations.manage')
  resolve(
    @Param('id') id: string,
    @Body() body: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.conflictResolution.resolve(id, body, session.user.id);
  }
}
