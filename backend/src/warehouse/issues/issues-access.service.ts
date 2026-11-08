import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission } from '../../auth/permission-policy';
import { issueForbidden } from './issues.model';

@Injectable()
export class WarehouseIssuesAccessService {
  async assertAccess(
    tx: Prisma.TransactionClient,
    actor: string,
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
      (fromSheet && !hasPermission(user.role, 'warehouse.issue-sheets.manage'))
    )
      issueForbidden();
  }
}
