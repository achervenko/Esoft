import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  presentTemplateDetail,
  presentTemplateListItem,
  presentTemplateMaintenanceSettingsUsage,
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
    const orderBy: Prisma.ChecklistTemplateOrderByWithRelationInput =
      query.sortBy === 'state'
        ? { isActive: query.sortDirection === 'asc' ? 'desc' : 'asc' }
        : query.sortBy === 'questionCount'
          ? { id: 'asc' }
          : { [query.sortBy]: query.sortDirection };
    const ids =
      query.sortBy === 'questionCount'
        ? await this.questionCountIds(query)
        : null;
    const [items, total] = await Promise.all([
      this.prisma.checklistTemplate.findMany({
        include: templateListInclude,
        orderBy: [orderBy, { id: 'asc' }],
        skip: ids ? undefined : (query.page - 1) * query.limit,
        take: ids ? undefined : query.limit,
        where: ids ? { id: { in: ids.map((row) => row.id) } } : where,
      }),
      this.prisma.checklistTemplate.count({ where }),
    ]);

    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      items: (ids ? ids.map(({ id }) => byId.get(id)!) : items).map(
        presentTemplateListItem,
      ),
      limit: query.limit,
      page: query.page,
      total,
    };
  }

  private questionCountIds(query: TemplateQuery) {
    const active =
      query.state === 'ACTIVE'
        ? true
        : query.state === 'ARCHIVED'
          ? false
          : query.isActive;
    const direction =
      query.sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT t.id FROM checklist_templates t
      WHERE t.is_published = TRUE
        ${active === undefined ? Prisma.empty : Prisma.sql`AND t.is_active = ${active}`}
        ${query.search ? Prisma.sql`AND (t.name ILIKE ${`%${query.search}%`} OR t.description ILIKE ${`%${query.search}%`})` : Prisma.empty}
      ORDER BY (
        SELECT COUNT(*) FROM checklist_template_questions q
        JOIN checklist_template_modules m ON m.id = q.checklist_template_module_id
        WHERE m.checklist_template_id = t.id
      ) ${direction}, t.id ASC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
    `);
  }

  async get(id: number) {
    const [template, usage] = await Promise.all([
      this.repository.loadTemplateDetail(id),
      this.repository.loadTemplateMaintenanceSettingsUsage(id),
    ]);

    return {
      template: presentTemplateDetail(template),
      usage: presentTemplateMaintenanceSettingsUsage(usage),
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
