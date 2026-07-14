import { EquipmentStatus } from '@prisma/client';

export class CreateEquipmentDto {
  visibleId?: number;
  name?: string;
  manufacturerId?: number;
  modelId?: number;
  specifications?: string | null;
  serialNumber?: string | null;
  inventoryNumber?: string;
  countryId?: number | null;
  manufactureYear?: number | null;
  commissioningDate?: string | null;
  issueDate?: string | null;
  sectionId?: number;
  responsibleEmployeeId?: number;
  status?: EquipmentStatus;
  operationText?: string | null;
  notes?: string | null;
}
