import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { RequirePermission } from '../../auth/require-permission';
import { ReceiptIntegrationWarehousesService } from '../receipts/receipt-source-warehouses.service';
import { OneCInvoiceSchedulerService } from './one-c-invoice-scheduler.service';

@Controller('api/warehouse/integrations/sources/:code')
export class ReceiptIntegrationWarehousesController {
  constructor(
    private readonly warehouses: ReceiptIntegrationWarehousesService,
    private readonly scheduler: OneCInvoiceSchedulerService,
  ) {}

  @Get('warehouses')
  @RequirePermission('integrations.manage')
  list(@Param('code') code: string, @Session() session: UserSession<Auth>) {
    return this.warehouses.list(code, session.user.id);
  }

  @Put('warehouses')
  @RequirePermission('integrations.manage')
  save(
    @Param('code') code: string,
    @Body() value: unknown,
    @Session() session: UserSession<Auth>,
  ) {
    return this.warehouses.save(code, value, session.user.id);
  }

  @Get('invoice-schedule')
  @RequirePermission('integrations.manage')
  invoiceSchedule(
    @Param('code') code: string,
    @Session() session: UserSession<Auth>,
  ) {
    return this.scheduler.status(code, session.user.id);
  }
}
