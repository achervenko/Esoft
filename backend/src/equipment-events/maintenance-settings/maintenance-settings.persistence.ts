import { Prisma } from '@prisma/client';
import type {
  MaintenanceBaseSettingInput,
  MaintenanceSettingUpdateInput,
} from './maintenance-settings.validation';

type BuildSettingCreateDataParams = {
  equipmentModelId: number;
  maintenanceTypeId: number;
  input: MaintenanceBaseSettingInput;
};

export function buildSettingCreateData({
  equipmentModelId,
  maintenanceTypeId,
  input,
}: BuildSettingCreateDataParams): Prisma.EquipmentMaintenanceSettingCreateInput {
  return {
    checklistTemplateId: input.checklistTemplateId,
    equipmentModel: { connect: { id: equipmentModelId } },
    executionType: input.executionType,
    maintenanceType: { connect: { id: maintenanceTypeId } },
    ...buildPeriodicityData(input.periodicity),
  };
}

export function buildSettingUpdateData(
  input: MaintenanceSettingUpdateInput,
): Prisma.EquipmentMaintenanceSettingUpdateInput {
  const data: Prisma.EquipmentMaintenanceSettingUpdateInput = {};

  if ('checklistTemplateId' in input) {
    data.checklistTemplateId = input.checklistTemplateId;
  }

  if ('executionType' in input) {
    data.executionType = input.executionType;
  }

  if ('periodicity' in input) {
    Object.assign(data, buildPeriodicityData(input.periodicity));
  }

  return data;
}

function buildPeriodicityData(
  periodicity: MaintenanceBaseSettingInput['periodicity'] | undefined,
) {
  return {
    periodicityDays: periodicity?.days ?? null,
    periodicityMonths: periodicity?.months ?? null,
    periodicityWeeks: periodicity?.weeks ?? null,
    periodicityYears: periodicity?.years ?? null,
  };
}
