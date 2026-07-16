import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import type {
  parseChecklistModulePayload,
  parseChecklistModuleUpdatePayload,
  parseChecklistModulesQuery,
} from './checklist-modules.validation';
import { PrismaService } from '../../prisma/prisma.service';

type ModuleInput = ReturnType<typeof parseChecklistModulePayload>;
type ModuleUpdateInput = ReturnType<typeof parseChecklistModuleUpdatePayload>;
type ModuleQuery = ReturnType<typeof parseChecklistModulesQuery>;

@Injectable()
export class ChecklistModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ModuleQuery) {
    const where: Prisma.ChecklistModuleWhereInput = {
      isActive: query.isActive,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.checklistModule.findMany({
        orderBy: [{ [query.sortBy]: query.sortDirection }, { id: 'asc' }],
        select: checklistModuleSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        where,
      }),
      this.prisma.checklistModule.count({ where }),
    ]);

    return { items, limit: query.limit, page: query.page, total };
  }

  async get(id: number) {
    return { module: await this.loadModule(id) };
  }

  async create(input: ModuleInput, userId: string) {
    try {
      const module = await this.prisma.$transaction(async (tx) => {
        const created = await tx.checklistModule.create({
          data: {
            createdBy: userId,
            description: input.description,
            isActive: true,
            name: input.name,
            updatedBy: userId,
          },
          select: checklistModuleSelect,
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_module',
          fieldName: 'CHECKLIST_MODULE_CREATED',
          newValue: created,
          userId,
        });

        return created;
      });

      return { module };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async update(id: number, input: ModuleUpdateInput, userId: string) {
    try {
      const module = await this.prisma.$transaction(async (tx) => {
        const current = await this.loadModule(id, tx);

        if (!this.hasModuleChanges(current, input)) {
          return current;
        }

        const updated = await tx.checklistModule.update({
          data: {
            ...('description' in input
              ? { description: input.description }
              : {}),
            ...('name' in input ? { name: input.name } : {}),
            updatedBy: userId,
          },
          select: checklistModuleSelect,
          where: { id },
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: id,
          entityType: 'checklist_module',
          fieldName: 'CHECKLIST_MODULE_UPDATED',
          newValue: updated,
          oldValue: current,
          userId,
        });

        return updated;
      });

      return { module };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  activate(id: number, userId: string) {
    return this.setActive(id, true, userId);
  }

  deactivate(id: number, userId: string) {
    return this.setActive(id, false, userId);
  }

  private async setActive(id: number, isActive: boolean, userId: string) {
    try {
      const module = await this.prisma.$transaction(async (tx) => {
        const current = await this.loadModule(id, tx);

        const updateResult = await tx.checklistModule.updateMany({
          data: { isActive, updatedBy: userId },
          where: {
            id,
            isActive: {
              not: isActive,
            },
          },
        });

        if (updateResult.count !== 1) {
          throwChecklistConflict(
            isActive
              ? 'CHECKLIST_MODULE_ALREADY_ACTIVE'
              : 'CHECKLIST_MODULE_ALREADY_INACTIVE',
            isActive ? 'Модуль уже активен.' : 'Модуль уже отключён.',
          );
        }

        const updated = await tx.checklistModule.findUnique({
          select: checklistModuleSelect,
          where: { id },
        });

        if (!updated) {
          throwChecklistNotFound(
            'CHECKLIST_MODULE_NOT_FOUND',
            'Модуль чек-листа не найден.',
          );
        }

        await writeChecklistAudit(tx, {
          action: AuditAction.STATUS_CHANGE,
          entityId: id,
          entityType: 'checklist_module',
          fieldName: isActive
            ? 'CHECKLIST_MODULE_ACTIVATED'
            : 'CHECKLIST_MODULE_DEACTIVATED',
          newValue: updated,
          oldValue: current,
          userId,
        });

        return updated;
      });

      return { module };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  private hasModuleChanges(
    current: Prisma.ChecklistModuleGetPayload<{
      select: typeof checklistModuleSelect;
    }>,
    input: ModuleUpdateInput,
  ) {
    return (
      ('description' in input && current.description !== input.description) ||
      ('name' in input && current.name !== input.name)
    );
  }

  private async loadModule(
    id: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const module = await tx.checklistModule.findUnique({
      select: checklistModuleSelect,
      where: { id },
    });

    if (!module) {
      throwChecklistNotFound(
        'CHECKLIST_MODULE_NOT_FOUND',
        'Модуль чек-листа не найден.',
      );
    }

    return module;
  }
}

export const checklistModuleSelect = {
  createdAt: true,
  description: true,
  id: true,
  isActive: true,
  name: true,
  updatedAt: true,
} as const;
