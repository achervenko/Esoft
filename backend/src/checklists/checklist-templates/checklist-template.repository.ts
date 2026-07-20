import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import {
  type TemplateMaintenanceSettingUsage,
  templateDetailInclude,
} from './checklist-templates.types';

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
    const rows = await tx.$queryRaw<
      Array<{
        id: number;
        isActive: boolean;
        isPublished: boolean;
        version: number;
      }>
    >`
      SELECT
        id,
        is_active AS "isActive",
        is_published AS "isPublished",
        version
      FROM checklist_templates
      WHERE id = ${id}
      FOR UPDATE
    `;
    const template = rows[0];

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

  async loadTemplateMaintenanceSettingsUsage(
    templateId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.$queryRaw<TemplateMaintenanceSettingUsage[]>`
      SELECT
        setting.id,
        model.id AS "equipmentModelId",
        model.name AS "equipmentModelName",
        maintenance_type.id AS "maintenanceTypeId",
        maintenance_type.code AS "maintenanceTypeCode",
        maintenance_type.name AS "maintenanceTypeName"
      FROM equipment_maintenance_settings setting
      JOIN equipment_models model ON model.id = setting.equipment_model_id
      JOIN equipment_event_types maintenance_type
        ON maintenance_type.id = setting.maintenance_type_id
      WHERE setting.default_checklist_template_id = ${templateId}
      ORDER BY model.name, maintenance_type.name, setting.id
    `;
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
