import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseStockModule } from '../stock/stock.module';
import { WarehouseReservationsModule } from '../reservations/reservations.module';
import { WarehouseIssueSheetsModule } from '../issue-sheets/issue-sheets.module';
import { WarehouseIssuesController } from './issues.controller';
import { WarehouseIssuesService } from './issues.service';
import { WarehouseIssuesQueryService } from './issues-query.service';
import { WarehouseIssuesAccessService } from './issues-access.service';
import { WarehouseIssuePlanService } from './issues-plan.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WarehouseStockModule,
    WarehouseReservationsModule,
    WarehouseIssueSheetsModule,
  ],
  controllers: [WarehouseIssuesController],
  providers: [
    WarehouseIssuesService,
    WarehouseIssuesQueryService,
    WarehouseIssuesAccessService,
    WarehouseIssuePlanService,
  ],
})
export class WarehouseIssuesModule {}
