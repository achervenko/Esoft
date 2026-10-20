import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PpeAuditService } from './ppe-audit.service';
import { normDateString, type PpeNormRecord } from './ppe-norms.mapper';

type NormItem = PpeNormRecord['items'][number];

const normLabels = {
  gender: 'Пол',
  positionId: 'ID должности',
  position: 'Должность',
  effectiveFrom: 'Дата начала действия',
  effectiveTo: 'Дата окончания действия',
  transitionMode: 'Способ перехода',
  previousNormId: 'Предыдущая редакция',
};
const itemLabels = {
  normId: 'Редакция нормы',
  ppeItemId: 'ID позиции СИЗ',
  ppeItem: 'Позиция СИЗ',
  unit: 'Единица выдачи',
  type: 'Тип СИЗ',
  quantity: 'Количество',
  periodCount: 'Период',
  periodUnit: 'Единица периода',
};

@Injectable()
export class PpeNormsAuditService {
  constructor(private readonly audit: PpeAuditService) {}

  private normAuditValues(norm: PpeNormRecord) {
    return {
      gender: norm.gender,
      positionId: norm.positionId,
      position: norm.position.name,
      effectiveFrom: normDateString(norm.effectiveFrom),
      effectiveTo: norm.effectiveTo ? normDateString(norm.effectiveTo) : null,
      transitionMode: norm.transitionMode,
      previousNormId: norm.previousNormId,
    };
  }

  auditNorm(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    previous: PpeNormRecord | null,
    next: PpeNormRecord | null,
    actorUserId: string,
  ) {
    return this.audit.writeChanges({
      action,
      entityType: 'ppe_norm',
      entityId: (next ?? previous)!.id,
      actorUserId,
      tx,
      previous: previous ? this.normAuditValues(previous) : null,
      next: next
        ? this.normAuditValues(next)
        : Object.fromEntries(Object.keys(normLabels).map((key) => [key, null])),
      labels: normLabels,
    });
  }

  private itemAuditValues(item: NormItem) {
    return {
      normId: item.normId,
      ppeItemId: item.ppeItemId,
      ppeItem: `${item.ppeItem.article} — ${item.ppeNameSnapshot}`,
      unit: item.ppeUnitSnapshot,
      type: item.ppeItemTypeSnapshot,
      quantity: item.quantity.toNumber(),
      periodCount: item.periodCount,
      periodUnit: item.periodUnit,
    };
  }

  auditItem(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    previous: NormItem | null,
    next: NormItem | null,
    actorUserId: string,
  ) {
    const item = next ?? previous;
    if (!item) return;
    return this.audit.writeChanges({
      action,
      entityType: 'ppe_norm_item',
      entityId: item.id,
      actorUserId,
      tx,
      previous: previous ? this.itemAuditValues(previous) : null,
      next: next
        ? this.itemAuditValues(next)
        : Object.fromEntries(Object.keys(itemLabels).map((key) => [key, null])),
      labels: itemLabels,
    });
  }
}
