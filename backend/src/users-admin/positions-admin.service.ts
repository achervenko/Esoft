import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseBoolean, throwBadRequest } from './users-admin.validation';

@Injectable()
export class PositionsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  list() {
    return this.prisma.position.findMany({ orderBy: { name: 'asc' } });
  }

  async save(
    id: number | null,
    payload: { name?: unknown },
    actorUserId: string,
  ) {
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      throwBadRequest('POSITION_NAME_REQUIRED', 'Укажите название должности.');
    }
    const name = payload.name.trim();
    if (name.length > 64) {
      throwBadRequest(
        'VALUE_TOO_LONG',
        'Название должности не должно превышать 64 символа.',
      );
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous =
          id === null
            ? ((
                await tx.$queryRaw<
                  Array<{ id: number; name: string; isActive: boolean }>
                >`
              SELECT id, name, is_active AS "isActive" FROM positions
              WHERE lower(name) = lower(${name}) FOR UPDATE
            `
              )[0] ?? null)
            : await this.lockPosition(tx, id);
        if (id === null && previous?.isActive) {
          throwBadRequest(
            'POSITION_ALREADY_EXISTS',
            'Такая должность уже существует.',
          );
        }
        const isRestoring = id === null && previous !== null;
        const position =
          id === null
            ? previous
              ? await tx.position.update({
                  where: { id: previous.id },
                  data: { isActive: true },
                })
              : await tx.position.create({ data: { name } })
            : await tx.position.update({ where: { id }, data: { name } });
        await this.audit.writeFieldChanges({
          module: AuditModule.USERS,
          action: isRestoring
            ? AuditAction.STATUS_CHANGE
            : previous
              ? AuditAction.UPDATE
              : AuditAction.CREATE,
          entityType: 'position',
          entityId: position.id,
          userId: actorUserId,
          fields: isRestoring
            ? [
                {
                  fieldName: 'Статус должности',
                  oldValue: 'удалена',
                  newValue: 'активна',
                },
              ]
            : previous?.name === name
              ? []
              : [
                  {
                    fieldName: 'Название должности',
                    oldValue: previous?.name,
                    newValue: name,
                  },
                ],
          tx,
        });
        return position;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throwBadRequest(
          'POSITION_ALREADY_EXISTS',
          'Такая должность уже существует.',
        );
      }
      throw error;
    }
  }

  async setStatus(id: number, value: unknown, actorUserId: string) {
    const isActive = parseBoolean(value);
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.lockPosition(tx, id);
      const position = await tx.position.update({
        where: { id },
        data: { isActive },
      });
      if (previous.isActive !== isActive) {
        await this.audit.writeFieldChanges({
          module: AuditModule.USERS,
          action: AuditAction.STATUS_CHANGE,
          entityType: 'position',
          entityId: id,
          userId: actorUserId,
          fields: [
            {
              fieldName: 'Статус должности',
              oldValue: previous.isActive ? 'активна' : 'удалена',
              newValue: isActive ? 'активна' : 'удалена',
            },
          ],
          tx,
        });
      }
      return position;
    });
  }

  private async lockPosition(tx: Prisma.TransactionClient, id: number) {
    const rows = await tx.$queryRaw<
      Array<{ id: number; name: string; isActive: boolean }>
    >`
      SELECT id, name, is_active AS "isActive" FROM positions WHERE id = ${id} FOR UPDATE
    `;
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: 'Должность не найдена.',
      });
    }
    return rows[0];
  }
}
