import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission } from '../../auth/permission-policy';
import { issueConflict, issueForbidden } from './issues.model';

@Injectable()
export class WarehouseIssuesAccessService {
  async assertAccess(
    tx: Prisma.TransactionClient,
    actor: string,
    override: boolean,
    fromSheet = false,
  ) {
    if (!actor || typeof actor !== 'string') issueForbidden();
    const [user] = await tx.$queryRaw<
      { role: string | null; banned: boolean | null }[]
    >`SELECT role, banned FROM "user" WHERE id = ${actor} FOR SHARE`;
    if (
      !user ||
      user.banned ||
      !hasPermission(user.role, 'warehouse.issues.manage') ||
      (fromSheet &&
        !hasPermission(user.role, 'warehouse.issue-sheets.manage')) ||
      (override && !hasPermission(user.role, 'warehouse.reservations.override'))
    )
      issueForbidden();
  }
  async assertProject(tx: Prisma.TransactionClient, projectId: bigint | null) {
    if (projectId === null) return;
    const [project] = await tx.$queryRaw<
      { is_active: boolean }[]
    >`SELECT is_active FROM warehouse_projects WHERE id = ${projectId} FOR SHARE`;
    if (!project?.is_active)
      issueConflict(
        'WAREHOUSE_ISSUE_PROJECT_UNAVAILABLE',
        'Проект недоступен.',
      );
  }
}
