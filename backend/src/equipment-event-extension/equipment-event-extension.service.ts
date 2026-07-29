import { Injectable } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import {
  throwEquipmentEventExtensionBadRequest,
  throwEquipmentEventExtensionNotFound,
} from './equipment-event-extension.errors';
import { EquipmentEventExtensionInputLoader } from './equipment-event-extension-input.loader';
import type {
  EquipmentEventExtensionCreateInput,
  EquipmentEventExtensionUpdateInput,
  PreparedEquipmentEventExtensionCreate,
  PreparedEquipmentEventExtensionUpdate,
} from './equipment-event-extension.command.types';

@Injectable()
export class EquipmentEventExtensionService {
  constructor(
    private readonly inputLoader: EquipmentEventExtensionInputLoader,
  ) {}

  async prepareCreate(
    tx: Prisma.TransactionClient,
    input: EquipmentEventExtensionCreateInput,
  ): Promise<PreparedEquipmentEventExtensionCreate> {
    const equipment = await this.inputLoader.loadAndLockEquipmentByVisibleId(
      tx,
      input.equipmentVisibleId,
    );
    const maintenanceSetting =
      await this.inputLoader.loadActiveApplicableMaintenanceSetting(tx, {
        equipmentModelId: equipment.modelId,
        maintenanceTypeId: input.maintenanceTypeId,
      });

    return {
      equipmentId: equipment.id,
      eventTypeId: input.maintenanceTypeId,
      executionType: maintenanceSetting.executionType,
      maintenanceSettingId: maintenanceSetting.id,
    };
  }

  async create(
    tx: Prisma.TransactionClient,
    eventId: number,
    prepared: PreparedEquipmentEventExtensionCreate,
  ): Promise<void> {
    const event = await tx.event.findFirst({
      where: {
        id: eventId,
        extensionCode: EventExtensionCode.EQUIPMENT,
      },
      select: {
        id: true,
      },
    });

    if (!event) {
      throwEquipmentEventExtensionNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    await tx.equipmentEventExtension.create({
      data: {
        eventId,
        equipmentId: prepared.equipmentId,
        eventTypeId: prepared.eventTypeId,
        executionType: prepared.executionType,
        maintenanceSettingId: prepared.maintenanceSettingId,
      },
    });
  }

  async prepareUpdateCreated(
    tx: Prisma.TransactionClient,
    eventId: number,
    input: EquipmentEventExtensionUpdateInput,
  ): Promise<PreparedEquipmentEventExtensionUpdate> {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        equipmentExtension: {
          select: {
            equipment: {
              select: {
                id: true,
                modelId: true,
              },
            },
            eventTypeId: true,
            maintenanceSettingId: true,
          },
        },
        extensionCode: true,
        id: true,
      },
    });

    if (
      !event ||
      event.extensionCode !== EventExtensionCode.EQUIPMENT ||
      !event.equipmentExtension
    ) {
      throwEquipmentEventExtensionNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    const shouldValidateMaintenanceSetting =
      input.equipmentVisibleId !== undefined ||
      input.maintenanceTypeId !== undefined;
    const equipment =
      input.equipmentVisibleId !== undefined
        ? await this.inputLoader.loadAndLockEquipmentByVisibleId(
            tx,
            input.equipmentVisibleId,
          )
        : await this.inputLoader.loadAndLockEquipmentById(
            tx,
            event.equipmentExtension.equipment.id,
          );
    const eventTypeId =
      input.maintenanceTypeId ?? event.equipmentExtension.eventTypeId;
    const maintenanceSetting = shouldValidateMaintenanceSetting
      ? await this.inputLoader.loadActiveApplicableMaintenanceSetting(tx, {
          equipmentModelId: equipment.modelId,
          maintenanceTypeId: eventTypeId,
        })
      : undefined;

    return {
      equipmentId:
        equipment.id === event.equipmentExtension.equipment.id
          ? undefined
          : equipment.id,
      eventTypeId:
        eventTypeId === event.equipmentExtension.eventTypeId
          ? undefined
          : eventTypeId,
      finalMaintenanceSettingId:
        maintenanceSetting?.id ?? event.equipmentExtension.maintenanceSettingId,
      maintenanceSetting,
    };
  }

  async updateCreated(
    tx: Prisma.TransactionClient,
    eventId: number,
    prepared: PreparedEquipmentEventExtensionUpdate,
  ): Promise<void> {
    if (
      prepared.equipmentId === undefined &&
      prepared.eventTypeId === undefined &&
      prepared.maintenanceSetting === undefined
    ) {
      return;
    }

    await tx.equipmentEventExtension.update({
      where: { eventId },
      data: {
        ...(prepared.equipmentId !== undefined
          ? { equipmentId: prepared.equipmentId }
          : {}),
        ...(prepared.eventTypeId !== undefined
          ? { eventTypeId: prepared.eventTypeId }
          : {}),
        ...(prepared.maintenanceSetting
          ? {
              executionType: prepared.maintenanceSetting.executionType,
              maintenanceSettingId: prepared.maintenanceSetting.id,
            }
          : {}),
      },
    });
  }

  async assertChecklistTemplatesAllowed(
    tx: Prisma.TransactionClient,
    maintenanceSettingId: number,
    checklistTemplateIds: number[],
  ): Promise<void> {
    const uniqueTemplateIds = [...new Set(checklistTemplateIds)];

    if (uniqueTemplateIds.length === 0) {
      return;
    }

    await this.assertTemplatesMatchMaintenanceSetting(tx, {
      checklistTemplateIds: uniqueTemplateIds,
      maintenanceSettingId,
    });

    const activeChecklistTemplates = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM checklist_templates
      WHERE id IN (${Prisma.join(uniqueTemplateIds)})
        AND is_active IS TRUE
        AND is_published IS TRUE
      FOR UPDATE
    `;

    if (activeChecklistTemplates.length !== uniqueTemplateIds.length) {
      throwEquipmentEventExtensionBadRequest(
        'CHECKLIST_TEMPLATE_INACTIVE',
        'Можно использовать только активные шаблоны чек-листов.',
      );
    }
  }

  private async assertTemplatesMatchMaintenanceSetting(
    tx: Prisma.TransactionClient,
    params: {
      checklistTemplateIds: number[];
      maintenanceSettingId: number;
    },
  ) {
    const settings = await tx.$queryRaw<
      Array<{
        default_checklist_template_id: number | null;
      }>
    >`
      SELECT default_checklist_template_id
      FROM equipment_maintenance_settings
      WHERE id = ${params.maintenanceSettingId}
      FOR SHARE
    `;
    const setting = settings[0];

    if (!setting?.default_checklist_template_id) {
      throwEquipmentEventExtensionBadRequest(
        'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
        'Для настройки обслуживания не задан шаблон чек-листа.',
      );
    }

    if (
      params.checklistTemplateIds.length !== 1 ||
      params.checklistTemplateIds[0] !== setting.default_checklist_template_id
    ) {
      throwEquipmentEventExtensionBadRequest(
        'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
        'Шаблон чек-листа не подходит для выбранного вида обслуживания.',
      );
    }
  }
}
