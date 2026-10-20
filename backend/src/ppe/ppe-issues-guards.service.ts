import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { PpeIssueNormsGuardService } from './ppe-issue-norms-guard.service';
import { PpeIssueCatalogGuardService } from './ppe-issue-catalog-guard.service';
import { PpeIssueSizeService } from './ppe-issue-size.service';
export {
  issueNormInclude,
  type IssueNorm,
  type IssueEmployee,
} from './ppe-issue-norms-guard.service';
export type { IssueCatalogItem } from './ppe-issue-catalog-guard.service';
export type { PpeIssueWarning } from './ppe-issue-size.service';

@Injectable()
export class PpeIssuesGuardsService {
  constructor(
    private readonly norms: PpeIssueNormsGuardService,
    private readonly catalog: PpeIssueCatalogGuardService,
    private readonly sizes: PpeIssueSizeService,
  ) {}
  lockEmployee(...args: Parameters<PpeIssueNormsGuardService['lockEmployee']>) {
    return this.norms.lockEmployee(...args);
  }
  lockPosition(...args: Parameters<PpeIssueNormsGuardService['lockPosition']>) {
    return this.norms.lockPosition(...args);
  }
  lockEmployeeNorms(
    ...args: Parameters<PpeIssueNormsGuardService['lockEmployeeNorms']>
  ) {
    return this.norms.lockEmployeeNorms(...args);
  }
  lockEffectiveNorm(
    ...args: Parameters<PpeIssueNormsGuardService['lockEffectiveNorm']>
  ) {
    return this.norms.lockEffectiveNorm(...args);
  }
  lockFutureNorm(
    ...args: Parameters<PpeIssueNormsGuardService['lockFutureNorm']>
  ) {
    return this.norms.lockFutureNorm(...args);
  }
  lockRequestedFutureNorms(
    ...args: Parameters<PpeIssueNormsGuardService['lockRequestedFutureNorms']>
  ) {
    return this.norms.lockRequestedFutureNorms(...args);
  }
  lockCatalog(...args: Parameters<PpeIssueCatalogGuardService['lockCatalog']>) {
    return this.catalog.lockCatalog(...args);
  }
  assertActive(
    ...args: Parameters<PpeIssueCatalogGuardService['assertActive']>
  ) {
    return this.catalog.assertActive(...args);
  }
  assertReplacement(
    ...args: Parameters<PpeIssueCatalogGuardService['assertReplacement']>
  ) {
    return this.catalog.assertReplacement(...args);
  }
  recommendSize(...args: Parameters<PpeIssueSizeService['recommendSize']>) {
    return this.sizes.recommendSize(...args);
  }
  resolveSize(...args: Parameters<PpeIssueSizeService['resolveSize']>) {
    return this.sizes.resolveSize(...args);
  }
  async actorName(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) ppeNotFound('PPE_ISSUE_ACTOR_NOT_FOUND');
    return user.name;
  }

  conflict(code: string, message: string): never {
    throw new ConflictException({ code, message });
  }
}
