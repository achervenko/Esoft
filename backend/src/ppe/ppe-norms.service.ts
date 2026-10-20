import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { PrismaService } from '../prisma/prisma.service';
import { PpeNormsGuardsService } from './ppe-norms-guards.service';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { PpeNormsFutureService } from './ppe-norms-future.service';
import { PpeNormsPersistenceService } from './ppe-norms-persistence.service';
import { ppeNotFound } from './ppe.errors';
import { normDateString, normInclude, toPpeNormDto } from './ppe-norms.mapper';
import {
  parseCreateNorm,
  parseNormGender,
  parseNormDate,
  parseNormId,
  parseNormRevision,
} from './ppe-norms.validation';
import { badPpeRequest, parsePpeObject } from './ppe.validation';

@Injectable()
export class PpeNormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guards: PpeNormsGuardsService,
    private readonly normAudit: PpeNormsAuditService,
    private readonly future: PpeNormsFutureService,
    private readonly persistence: PpeNormsPersistenceService,
  ) {}

  async list(positionId?: number) {
    if (positionId !== undefined)
      parseNormId(positionId, 'INVALID_POSITION_ID');
    const norms = await this.prisma.ppeNorm.findMany({
      where: positionId === undefined ? {} : { positionId },
      include: normInclude,
      orderBy: [
        { positionId: 'asc' },
        { effectiveFrom: 'desc' },
        { id: 'desc' },
      ],
    });
    return norms.map(toPpeNormDto);
  }

  async findOne(id: number) {
    parseNormId(id);
    const norm = await this.prisma.ppeNorm.findUnique({
      where: { id },
      include: normInclude,
    });
    if (!norm) ppeNotFound('PPE_NORM_NOT_FOUND');
    return toPpeNormDto(norm);
  }

  async findEffectiveNorm(
    positionId: number,
    date: Date = getBusinessTodayDate(),
    genderValue?: unknown,
  ) {
    parseNormId(positionId, 'INVALID_POSITION_ID');
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      badPpeRequest(
        'INVALID_NORM_DATE',
        'Укажите корректную календарную дату.',
      );
    }
    const gender = parseNormGender(genderValue);
    const day = parseNormDate(normDateString(date));
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      select: { id: true },
    });
    if (!position) ppeNotFound('POSITION_NOT_FOUND');
    const norms = await this.prisma.ppeNorm.findMany({
      where: {
        positionId,
        gender,
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
      },
      include: normInclude,
      take: 2,
      orderBy: { effectiveFrom: 'desc' },
    });
    if (norms.length > 1) this.guards.periodConflict();
    return norms[0] ? toPpeNormDto(norms[0]) : null;
  }

  create(payload: unknown, actorUserId: string) {
    const data = parseCreateNorm(payload);
    return this.persistence.mutate(async (tx) => {
      await this.guards.lockPosition(tx, data.positionId);
      await this.guards.lockCatalog(tx, data.items);
      await this.guards.assertNoOverlap(tx, data.positionId, data);
      return this.persistence.createInTransaction(
        tx,
        data.positionId,
        data,
        actorUserId,
      );
    });
  }

  createRevision(id: number, payload: unknown, actorUserId: string) {
    parseNormId(id);
    const data = parseNormRevision(payload);
    return this.persistence.mutate(async (tx) => {
      const previous = await this.guards.lockNorm(tx, id);
      if (
        data.effectiveFrom <= previous.effectiveFrom ||
        data.effectiveFrom < getBusinessTodayDate()
      ) {
        badPpeRequest(
          'INVALID_NORM_DATE',
          'Новая редакция должна начинаться позже исходной и не раньше сегодняшнего дня.',
        );
      }
      // A revision must continue the latest period. Branching from an older
      // norm would skip intervening issue history in the entitlement chain.
      if (
        await tx.ppeNorm.findFirst({
          where: {
            positionId: previous.positionId,
            gender: previous.gender,
            effectiveFrom: { gt: previous.effectiveFrom },
          },
          select: { id: true },
        })
      )
        this.guards.periodConflict();
      await this.guards.lockCatalog(tx, data.items);
      const closesPrevious = previous.effectiveTo === null;
      await this.guards.assertNoOverlap(
        tx,
        previous.positionId,
        { ...data, gender: previous.gender },
        closesPrevious ? id : undefined,
      );
      if (closesPrevious) {
        const effectiveTo = new Date(data.effectiveFrom.getTime() - 86_400_000);
        const conflictingIssues = await tx.ppeIssue.count({
          where: { normItem: { normId: id }, issuedAt: { gt: effectiveTo } },
        });
        if (conflictingIssues > 0) this.guards.locked();
        const closed = await tx.ppeNorm.update({
          where: { id },
          data: { effectiveTo },
          include: normInclude,
        });
        await this.normAudit.auditNorm(
          tx,
          AuditAction.UPDATE,
          previous,
          closed,
          actorUserId,
        );
      }
      return this.persistence.createInTransaction(
        tx,
        previous.positionId,
        { ...data, gender: previous.gender },
        actorUserId,
        previous.id,
      );
    });
  }

  updateFuture(id: number, payload: unknown, actorUserId: string) {
    return this.future.update(id, payload, actorUserId);
  }

  end(id: number, payload: unknown, actorUserId: string) {
    parseNormId(id);
    const values = parsePpeObject(payload, ['effectiveTo']);
    const effectiveTo = parseNormDate(values.effectiveTo);
    return this.persistence.mutate(async (tx) => {
      const previous = await this.guards.lockNorm(tx, id);
      const today = getBusinessTodayDate();
      if (
        previous.effectiveFrom > today ||
        (previous.effectiveTo && previous.effectiveTo < today)
      )
        this.guards.locked();
      if (
        effectiveTo < today ||
        (previous.effectiveTo && effectiveTo > previous.effectiveTo)
      )
        badPpeRequest(
          'INVALID_NORM_DATE',
          'Дата окончания должна быть не раньше сегодняшнего дня и не продлевать действие нормы.',
        );
      if (
        await tx.ppeIssue.count({
          where: { normItem: { normId: id }, issuedAt: { gt: effectiveTo } },
        })
      )
        this.guards.locked();
      const next = await tx.ppeNorm.update({
        where: { id },
        data: { effectiveTo },
        include: normInclude,
      });
      await this.normAudit.auditNorm(
        tx,
        AuditAction.UPDATE,
        previous,
        next,
        actorUserId,
      );
      return toPpeNormDto(next);
    });
  }

  deleteFuture(id: number, actorUserId: string) {
    return this.future.delete(id, actorUserId);
  }
}
