import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseFilters,
  HttpCode,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { RequirePermission } from '../auth/require-permission';
import { IntegrationFailureFilter } from '../integrations/integration-failure.filter';
import { OrdersService } from './orders.service';
import { OrdersSyncService } from './orders-sync.service';
import { orderId } from './orders.validation';
@Controller('api/orders')
@UseFilters(IntegrationFailureFilter)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly sync: OrdersSyncService,
  ) {}
  @Get()
  @RequirePermission('orders.read')
  list(@Query() query: unknown) {
    return this.orders.list(query);
  }
  @Get('sources')
  @RequirePermission('orders.read')
  sources() {
    return this.orders.sources();
  }
  @Post('sources/:id/refresh')
  @HttpCode(200)
  @RequirePermission('integrations.manage')
  refresh(@Param('id') id: string, @Session() session: UserSession<Auth>) {
    return this.sync.sync(orderId(id), session.user.id);
  }
  @Get(':id')
  @RequirePermission('orders.read')
  findOne(@Param('id') id: string) {
    return this.orders.findOne(id);
  }
  @Get(':id/history')
  @RequirePermission('orders.read')
  history(@Param('id') id: string, @Query() query: unknown) {
    return this.orders.history(id, query);
  }
}
