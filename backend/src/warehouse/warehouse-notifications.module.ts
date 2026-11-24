import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WarehouseNotificationsService } from './warehouse-notifications.service';

@Module({
  imports: [NotificationsModule],
  providers: [WarehouseNotificationsService],
  exports: [WarehouseNotificationsService],
})
export class WarehouseNotificationsModule {}
