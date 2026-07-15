import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceSettingsAssertions } from './maintenance-settings.assertions';
import {
  writeMaintenanceEventTypeCreatedAudit,
  writeMaintenanceSettingCreatedAudit,
  writeMaintenanceSettingDeletedAudit,
  writeMaintenanceSettingUpdatedAudit,
} from './maintenance-settings.audit';
import { throwMaintenanceSettingPrismaError } from './maintenance-settings.errors';
import {
  maintenanceSettingSelect,
  maintenanceSettingsEventTypeSelect,
  type MaintenanceSettingsEquipmentRecord,
} from './maintenance-settings.relations';
import {
  buildSettingCreateData,
  buildSettingUpdateData,
} from './maintenance-settings.persistence';
import {
  presentAvailableEventTypes,
  presentMaintenanceSettings,
} from './maintenance-settings.presenter';
import type {
  MaintenanceEventTypeInput,
  MaintenanceSettingInput,
  MaintenanceSettingUpdateInput,
} from './maintenance-settings.validation';

@Injectable()
export class MaintenanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: MaintenanceSettingsAssertions,
  ) {}

  getSettings(visibleId: number) {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await this.assertions.loadEquipmentByVisibleId(
        tx,
        visibleId,
      );

      return this.buildSettingsResponse(tx, equipment);
    });
  }

  getAvailableEventTypes(visibleId: number) {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await this.assertions.loadEquipmentByVisibleId(
        tx,
        visibleId,
      );

      const assignedSettings = await tx.equipmentModelEventType.findMany({
        select: { eventTypeId: true },
        where: { equipmentModelId: equipment.modelId },
      });

      const assignedEventTypeIds = assignedSettings.map(
        (setting) => setting.eventTypeId,
      );

      const eventTypes = await tx.equipmentEventType.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: maintenanceSettingsEventTypeSelect,
        where: {
          id:
            assignedEventTypeIds.length > 0
              ? { notIn: assignedEventTypeIds }
              : undefined,
          isActive: true,
        },
      });

      return presentAvailableEventTypes(eventTypes);
    });
  }

  async createSetting(
    visibleId: number,
    input: MaintenanceSettingInput,
    userId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const equipment = await this.assertions.loadEquipmentByVisibleId(
          tx,
          visibleId,
        );

        await this.assertions.assertActiveEventType(tx, input.eventTypeId);
        await this.assertions.assertSettingDoesNotExist(
          tx,
          equipment.modelId,
          input.eventTypeId,
        );

        await tx.equipmentModelEventType.create({
          data: buildSettingCreateData({
            equipmentModelId: equipment.modelId,
            eventTypeId: input.eventTypeId,
            input,
          }),
        });

        const [affectedEquipmentCount, setting] = await Promise.all([
          this.countAffectedEquipment(tx, equipment.modelId),
          this.assertions.assertSettingExists(
            tx,
            equipment.modelId,
            input.eventTypeId,
          ),
        ]);

        await writeMaintenanceSettingCreatedAudit(tx, {
          affectedEquipmentCount,
          equipment,
          setting,
          userId,
        });

        return this.buildSettingsResponse(tx, equipment);
      });
    } catch (error) {
      throwMaintenanceSettingPrismaError(error);
    }
  }

  async updateSetting(
    visibleId: number,
    eventTypeId: number,
    input: MaintenanceSettingUpdateInput,
    userId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const equipment = await this.assertions.loadEquipmentByVisibleId(
          tx,
          visibleId,
        );

        const oldSetting = await this.assertions.assertSettingExists(
          tx,
          equipment.modelId,
          eventTypeId,
        );

        await tx.equipmentModelEventType.update({
          data: buildSettingUpdateData(input),
          where: {
            equipmentModelId_eventTypeId: {
              equipmentModelId: equipment.modelId,
              eventTypeId,
            },
          },
        });

        const newSetting = await this.assertions.assertSettingExists(
          tx,
          equipment.modelId,
          eventTypeId,
        );

        await writeMaintenanceSettingUpdatedAudit(tx, {
          equipment,
          newSetting,
          oldSetting,
          userId,
        });

        return this.buildSettingsResponse(tx, equipment);
      });
    } catch (error) {
      throwMaintenanceSettingPrismaError(error);
    }
  }

  async deleteSetting(
    visibleId: number,
    eventTypeId: number,
    userId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const equipment = await this.assertions.loadEquipmentByVisibleId(
          tx,
          visibleId,
        );

        const setting = await this.assertions.assertSettingExists(
          tx,
          equipment.modelId,
          eventTypeId,
        );
        const affectedEquipmentCount = await this.countAffectedEquipment(
          tx,
          equipment.modelId,
        );

        await tx.equipmentModelEventType.delete({
          where: {
            equipmentModelId_eventTypeId: {
              equipmentModelId: equipment.modelId,
              eventTypeId,
            },
          },
        });

        await writeMaintenanceSettingDeletedAudit(tx, {
          affectedEquipmentCount,
          equipment,
          setting,
          userId,
        });

        return this.buildSettingsResponse(tx, equipment);
      });
    } catch (error) {
      throwMaintenanceSettingPrismaError(error);
    }
  }

  async createEventTypeAndSetting(
    visibleId: number,
    input: MaintenanceEventTypeInput,
    userId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const equipment = await this.assertions.loadEquipmentByVisibleId(
          tx,
          visibleId,
        );

        await this.assertions.assertEventTypeCodeAndNameAreFree(
          tx,
          input.code,
          input.name,
        );

        const eventType = await tx.equipmentEventType.create({
          data: {
            code: input.code,
            name: input.name,
          },
          select: { id: true },
        });

        await writeMaintenanceEventTypeCreatedAudit(tx, {
          code: input.code,
          eventTypeId: eventType.id,
          name: input.name,
          userId,
        });

        await tx.equipmentModelEventType.create({
          data: buildSettingCreateData({
            equipmentModelId: equipment.modelId,
            eventTypeId: eventType.id,
            input,
          }),
        });

        const [affectedEquipmentCount, setting] = await Promise.all([
          this.countAffectedEquipment(tx, equipment.modelId),
          this.assertions.assertSettingExists(
            tx,
            equipment.modelId,
            eventType.id,
          ),
        ]);

        await writeMaintenanceSettingCreatedAudit(tx, {
          affectedEquipmentCount,
          equipment,
          setting,
          userId,
        });

        return this.buildSettingsResponse(tx, equipment);
      });
    } catch (error) {
      throwMaintenanceSettingPrismaError(error);
    }
  }

  private async buildSettingsResponse(
    tx: Prisma.TransactionClient,
    equipment: MaintenanceSettingsEquipmentRecord,
  ) {
    const affectedEquipmentCount = await this.countAffectedEquipment(
      tx,
      equipment.modelId,
    );
    const settings = await tx.equipmentModelEventType.findMany({
      orderBy: [{ eventType: { name: 'asc' } }, { eventTypeId: 'asc' }],
      select: maintenanceSettingSelect,
      where: { equipmentModelId: equipment.modelId },
    });

    return presentMaintenanceSettings(
      equipment,
      affectedEquipmentCount,
      settings,
    );
  }

  private countAffectedEquipment(
    tx: Prisma.TransactionClient,
    equipmentModelId: number,
  ) {
    return tx.equipment.count({ where: { modelId: equipmentModelId } });
  }
}
