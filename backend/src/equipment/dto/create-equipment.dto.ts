import { EquipmentStatus } from '@prisma/client';

export class CreateEquipmentDto {
  id?: number;
  name?: string;
  manufacturerId?: number | null;
  model?: string | null;
  specifications?: string | null;
  serialNumber?: string | null;
  inventoryNumber?: string;
  countryId?: number | null;
  manufactureYear?: number | null;
  commissioningDate?: string | null;
  sectionId?: number;
  responsibleEmployeeId?: number | null;
  status?: EquipmentStatus;
  operationText?: string | null;
  notes?: string | null;
}
