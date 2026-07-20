import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { checklistModuleSelect } from './checklist-modules.select';
import type {
  ChecklistModuleView,
  ModuleInput,
  ModuleQuery,
  ModuleUpdateInput,
} from './checklist-modules.types';

@Injectable()
export class ChecklistModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(operation);
  }

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

  findById(id: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.checklistModule.findUnique({
      select: checklistModuleSelect,
      where: { id },
    });
  }

  async loadForMutation(id: number, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<ChecklistModuleView[]>`
      SELECT
        created_at AS "createdAt",
        description,
        id,
        is_active AS "isActive",
        name,
        sort_order AS "sortOrder",
        updated_at AS "updatedAt"
      FROM checklist_modules
      WHERE id = ${id}
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  create(
    input: ModuleInput,
    userId: string,
    sortOrder: number,
    tx: Prisma.TransactionClient,
  ) {
    return tx.checklistModule.create({
      data: {
        createdBy: userId,
        description: input.description,
        isActive: true,
        name: input.name,
        sortOrder,
        updatedBy: userId,
      },
      select: checklistModuleSelect,
    });
  }

  update(
    id: number,
    input: ModuleUpdateInput,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.checklistModule.update({
      data: {
        ...('description' in input ? { description: input.description } : {}),
        ...('name' in input ? { name: input.name } : {}),
        updatedBy: userId,
      },
      select: checklistModuleSelect,
      where: { id },
    });
  }

  updateStatus(
    id: number,
    data: { isActive: boolean; sortOrder: number; updatedBy: string },
    tx: Prisma.TransactionClient,
  ) {
    return tx.checklistModule.update({
      data,
      where: { id },
    });
  }

  updateSortOrder(
    id: number,
    sortOrder: number,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.checklistModule.update({
      data: { sortOrder, updatedBy: userId },
      where: { id },
    });
  }

  findActiveOrdered(tx: Prisma.TransactionClient = this.prisma) {
    return tx.checklistModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: checklistModuleSelect,
      where: { isActive: true },
    });
  }

  findActiveIdsOrdered(tx: Prisma.TransactionClient) {
    return tx.checklistModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
      where: { isActive: true },
    });
  }

  async getNextActiveSortOrder(tx: Prisma.TransactionClient) {
    const aggregate = await tx.checklistModule.aggregate({
      _max: { sortOrder: true },
      where: { isActive: true },
    });

    return (aggregate._max.sortOrder ?? 0) + 1;
  }

  deactivateQuestionsByModuleId(
    moduleId: number,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.checklistQuestion.updateMany({
      data: {
        isActive: false,
        updatedBy: userId,
      },
      where: { checklistModuleId: moduleId, isActive: true },
    });
  }
}
