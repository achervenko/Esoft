import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  presentTemplateDetail,
  presentTemplateListItem,
} from './checklist-templates.presenter';
import {
  type TemplateQuery,
  templateListInclude,
} from './checklist-templates.types';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async list(query: TemplateQuery) {
    const where = this.buildTemplateWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.checklistTemplate.findMany({
        include: templateListInclude,
        orderBy: [{ [query.sortBy]: query.sortDirection }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        where,
      }),
      this.prisma.checklistTemplate.count({ where }),
    ]);

    return {
      items: items.map(presentTemplateListItem),
      limit: query.limit,
      page: query.page,
      total,
    };
  }

  async get(id: number) {
    return {
      template: presentTemplateDetail(
        await this.repository.loadTemplateDetail(id),
      ),
    };
  }

  private buildTemplateWhere(
    query: TemplateQuery,
  ): Prisma.ChecklistTemplateWhereInput {
    return {
      isActive:
        query.state === 'ACTIVE'
          ? true
          : query.state === 'ARCHIVED'
            ? false
            : query.isActive,
      isPublished: true,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }
}
