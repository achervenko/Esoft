import { Prisma } from '@prisma/client';
import type {
  MaintenanceBaseSettingInput,
  MaintenanceSettingUpdateInput,
} from './maintenance-settings.types';

type BuildSettingCreateDataParams = {
  equipmentModelId: number;
  maintenanceTypeId: number;
  input: MaintenanceBaseSettingInput & {
    createdBy?: string;
  };
};

export function buildSettingCreateData({
  equipmentModelId,
  maintenanceTypeId,
  input,
}: BuildSettingCreateDataParams): Prisma.EquipmentMaintenanceSettingCreateInput {
  const checklistTemplateLinks = buildChecklistTemplateLinks(
    input.checklistTemplates,
    input.createdBy,
  );

  return {
    checklistTemplateLinks,
    equipmentModel: { connect: { id: equipmentModelId } },
    executionType: input.executionType,
    maintenanceType: { connect: { id: maintenanceTypeId } },
    ...buildPeriodicityData(input.periodicity),
  };
}

function buildChecklistTemplateLinks(
  checklistTemplates: MaintenanceBaseSettingInput['checklistTemplates'],
  createdBy?: string,
) {
  if (checklistTemplates.length === 0) {
    return undefined;
  }

  if (!createdBy) {
    throw new Error('createdBy is required to create checklist template links.');
  }

  return {
    create: checklistTemplates.map((item) => ({
      checklistTemplate: { connect: { id: item.checklistTemplateId } },
      createdByUser: { connect: { id: createdBy } },
      isRequired: item.isRequired,
      sortOrder: item.sortOrder,
    })),
  };
}

export function buildSettingUpdateData(
  input: MaintenanceSettingUpdateInput,
): Prisma.EquipmentMaintenanceSettingUpdateInput {
  const data: Prisma.EquipmentMaintenanceSettingUpdateInput = {};

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
