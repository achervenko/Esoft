import { EquipmentStatus } from '@prisma/client';
import { throwEquipmentEventExtensionBadRequest } from './equipment-event-extension.errors';

export function assertEquipmentAllowsActiveEvents(
  status: EquipmentStatus,
): void {
  if (status === EquipmentStatus.WRITTEN_OFF) {
    throwEquipmentEventExtensionBadRequest(
      'EQUIPMENT_WRITTEN_OFF',
      'Для списанного оборудования нельзя создавать или изменять активные события.',
    );
  }
}
