import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type WarehouseProject } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockId } from '../stock/stock.validation';
import { parseProjectsQuery } from './projects.validation';
const select = {
  id: true,
  projectNumber: true,
  name: true,
  isActive: true,
} satisfies Prisma.WarehouseProjectSelect;
const dto = (row: WarehouseProject) => ({ ...row, id: String(row.id) });
@Injectable()
export class WarehouseProjectsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(value: unknown) {
    const q = parseProjectsQuery(value);
    const search = q.search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.WarehouseProjectWhereInput = {
      isActive: q.isActive,
      ...(search
        ? {
            OR: [
              { projectNumber: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.warehouseProject.findMany({
          where,
          select,
          orderBy: [{ projectNumber: 'asc' }, { id: 'asc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        });
        return {
          items: items.map(dto),
          total: await tx.warehouseProject.count({ where }),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findOne(value: string) {
    const row = await this.prisma.warehouseProject.findUnique({
      where: { id: stockId(value, 'projectId') },
      select,
    });
    if (!row)
      throw new NotFoundException({
        code: 'WAREHOUSE_PROJECT_NOT_FOUND',
        message: 'Проект не найден.',
      });
    return dto(row);
  }
}
