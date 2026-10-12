import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PpeAuditService } from './ppe-audit.service';
import { PpeCatalogSizesService } from './ppe-catalog-sizes.service';
import { PpeCatalogService } from './ppe-catalog.service';
import { PpeEmployeesService } from './ppe-employees.service';
import { PpeController } from './ppe.controller';
import { PpeNormsService } from './ppe-norms.service';
import { PpeNormsFutureService } from './ppe-norms-future.service';
import { PpeNormsPersistenceService } from './ppe-norms-persistence.service';
import { PpeNormsGuardsService } from './ppe-norms-guards.service';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { PpeIssuesController } from './ppe-issues.controller';
import { PpeIssuesService } from './ppe-issues.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { PpeIssuesAuditService } from './ppe-issues-audit.service';
import { PpeIssuePlanService } from './ppe-issue-plan.service';
import { PpeIssueCreateService } from './ppe-issue-create.service';
import { PpeIssueHistoryService } from './ppe-issue-history.service';
import { PpeNormTransitionService } from './ppe-norm-transition.service';
import { PpeNormPositionService } from './ppe-norm-position.service';
import { PpeNormIntervalTransitionService } from './ppe-norm-interval-transition.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PpeController, PpeIssuesController],
  providers: [
    PpeAuditService,
    PpeCatalogService,
    PpeCatalogSizesService,
    PpeEmployeesService,
    PpeNormsService,
    PpeNormsFutureService,
    PpeNormsPersistenceService,
    PpeNormsGuardsService,
    PpeNormsAuditService,
    PpeIssuesService,
    PpeIssuePlanService,
    PpeIssueCreateService,
    PpeIssueHistoryService,
    PpeIssuesGuardsService,
    PpeNormTransitionService,
    PpeNormPositionService,
    PpeNormIntervalTransitionService,
    PpeIssuesAuditService,
  ],
  exports: [PpeNormsService],
})
export class PpeModule {}
