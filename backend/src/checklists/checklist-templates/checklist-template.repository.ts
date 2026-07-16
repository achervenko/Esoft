import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import { templateDetailInclude } from './checklist-templates.types';

@Injectable()
export class ChecklistTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadTemplateDetail(
    id: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const template = await tx.checklistTemplate.findUnique({
      include: templateDetailInclude,
      where: { id },
    });

    if (!template) {
      throwChecklistNotFound(
        'CHECKLIST_TEMPLATE_NOT_FOUND',
        'Шаблон чек-листа не найден.',
      );
    }

    return template;
  }

  async loadTemplateForMutation(
    tx: Prisma.TransactionClient,
    id: number,
    expectedVersion?: number,
  ) {
    const template = await tx.checklistTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throwChecklistNotFound(
        'CHECKLIST_TEMPLATE_NOT_FOUND',
        'Шаблон чек-листа не найден.',
      );
    }

    if (expectedVersion !== undefined && template.version !== expectedVersion) {
      this.throwTemplateVersionConflict(id);
    }

    return template;
  }

  async touchTemplate(
    tx: Prisma.TransactionClient,
    id: number,
    userId: string,
    expectedVersion: number,
  ) {
    const updateResult = await tx.checklistTemplate.updateMany({
      data: { updatedBy: userId, version: { increment: 1 } },
      where: { id, version: expectedVersion },
    });

    this.assertSingleTemplateMutation(updateResult.count, id);
  }

  async updateTemplateByExpectedVersion(
    tx: Prisma.TransactionClient,
    params: {
      data: Prisma.ChecklistTemplateUncheckedUpdateManyInput;
      expectedVersion: number;
      id: number;
    },
  ) {
    const updateResult = await tx.checklistTemplate.updateMany({
      data: params.data,
      where: {
        id: params.id,
        version: params.expectedVersion,
      },
    });

    this.assertSingleTemplateMutation(updateResult.count, params.id);
  }

  assertVersionMatches(
    actualVersion: number,
    expectedVersion: number,
    templateId: number,
  ) {
    if (actualVersion !== expectedVersion) {
      this.throwTemplateVersionConflict(templateId);
    }
  }

  assertSingleTemplateMutation(count: number, templateId: number) {
    if (count !== 1) {
      this.throwTemplateVersionConflict(templateId);
    }
  }

  private throwTemplateVersionConflict(templateId: number): never {
    throwChecklistConflict(
      'CHECKLIST_TEMPLATE_VERSION_CONFLICT',
      'Шаблон был изменён другим пользователем.',
      { templateId },
    );
  }
}
