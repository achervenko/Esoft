import { Prisma } from '@prisma/client';
import type {
  MaintenanceBaseSettingInput,
  MaintenanceSettingUpdateInput,
} from './maintenance-settings.validation';

type BuildSettingCreateDataParams = {
  equipmentModelId: number;
  eventTypeId: number;
  input: MaintenanceBaseSettingInput;
};

export function buildSettingCreateData({
  equipmentModelId,
  eventTypeId,
  input,
}: BuildSettingCreateDataParams): Prisma.EquipmentModelEventTypeCreateInput {
  return {
    checklistTemplateId: input.checklistTemplateId,
    equipmentModel: { connect: { id: equipmentModelId } },
    eventType: { connect: { id: eventTypeId } },
    executionType: input.executionType,
    periodicityUnit: input.periodicity?.unit ?? null,
    periodicityValue: input.periodicity?.value ?? null,
  };
}

export function buildSettingUpdateData(
  input: MaintenanceSettingUpdateInput,
): Prisma.EquipmentModelEventTypeUpdateInput {
  const data: Prisma.EquipmentModelEventTypeUpdateInput = {};

  if ('checklistTemplateId' in input) {
    data.checklistTemplateId = input.checklistTemplateId;
  }

  if ('executionType' in input) {
    data.executionType = input.executionType;
  }

  if ('periodicity' in input) {
    data.periodicityUnit = input.periodicity?.unit ?? null;
    data.periodicityValue = input.periodicity?.value ?? null;
  }

  return data;
}
