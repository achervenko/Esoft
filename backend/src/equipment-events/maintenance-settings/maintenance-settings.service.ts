import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceSettingsAssertions } from './maintenance-settings.assertions';
import {
  writeMaintenanceSettingCreatedAudit,
  writeMaintenanceSettingDeletedAudit,
  writeMaintenanceSettingUpdatedAudit,
} from './maintenance-settings.audit';
import { throwMaintenanceSettingPrismaError } from './maintenance-settings.errors';
import {
  maintenanceSettingSelect,
  maintenanceSettingsMaintenanceTypeSelect,
  type MaintenanceSettingsEquipmentRecord,
} from './maintenance-settings.relations';
import {
  buildSettingCreateData,
  buildSettingUpdateData,
} from './maintenance-settings.persistence';
import {
  presentAvailableMaintenanceTypes,
  presentMaintenanceSettings,
} from './maintenance-settings.presenter';
import type {
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

  getAvailableMaintenanceTypes(visibleId: number) {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await this.assertions.loadEquipmentByVisibleId(
        tx,
        visibleId,
      );

      const assignedSettings = await tx.equipmentMaintenanceSetting.findMany({
        select: { maintenanceTypeId: true },
        where: { equipmentModelId: equipment.modelId },
      });

      const assignedMaintenanceTypeIds = assignedSettings.map(
        (setting) => setting.maintenanceTypeId,
      );

      const maintenanceTypes = await tx.equipmentEventType.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: maintenanceSettingsMaintenanceTypeSelect,
        where: {
          id:
            assignedMaintenanceTypeIds.length > 0
              ? { notIn: assignedMaintenanceTypeIds }
              : undefined,
          isActive: true,
        },
      });

      return presentAvailableMaintenanceTypes(maintenanceTypes);
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

        await this.assertions.assertActiveMaintenanceType(
          tx,
          input.maintenanceTypeId,
        );
        await this.assertions.assertSettingDoesNotExist(
          tx,
          equipment.modelId,
          input.maintenanceTypeId,
        );

        const createdSetting = await tx.equipmentMaintenanceSetting.create({
          data: buildSettingCreateData({
            equipmentModelId: equipment.modelId,
            maintenanceTypeId: input.maintenanceTypeId,
            input,
          }),
          select: { id: true },
        });

        const [affectedEquipmentCount, setting] = await Promise.all([
          this.countAffectedEquipment(tx, equipment.modelId),
          this.assertions.assertSettingExists(
            tx,
            equipment.modelId,
            createdSetting.id,
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
    settingId: number,
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
          settingId,
        );

        await tx.equipmentMaintenanceSetting.update({
          data: buildSettingUpdateData(input),
          where: { id: settingId },
        });

        const newSetting = await this.assertions.assertSettingExists(
          tx,
          equipment.modelId,
          settingId,
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
    settingId: number,
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
          settingId,
        );
        const affectedEquipmentCount = await this.countAffectedEquipment(
          tx,
          equipment.modelId,
        );

        await tx.equipmentMaintenanceSetting.delete({
          where: {
            id: settingId,
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

  private async buildSettingsResponse(
    tx: Prisma.TransactionClient,
    equipment: MaintenanceSettingsEquipmentRecord,
  ) {
    const affectedEquipmentCount = await this.countAffectedEquipment(
      tx,
      equipment.modelId,
    );
    const settings = await tx.equipmentMaintenanceSetting.findMany({
      orderBy: [{ maintenanceType: { name: 'asc' } }, { id: 'asc' }],
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
