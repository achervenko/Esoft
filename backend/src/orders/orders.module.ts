import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OrdersFlow } from './orders-flow';
import { OrdersService } from './orders.service';
import { OrdersSyncService } from './orders-sync.service';
import { OrdersController } from './orders.controller';
import { OrdersScheduler } from './orders-scheduler';
@Module({
  imports: [PrismaModule, IntegrationsModule],
  controllers: [OrdersController],
  providers: [OrdersFlow, OrdersService, OrdersSyncService, OrdersScheduler],
})
export class OrdersModule {}
