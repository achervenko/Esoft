import { Injectable, NotFoundException } from '@nestjs/common';
import {
  normalizeSearchText,
  removeInventorySeparators,
} from './search-normalization.helper';
import { EQUIPMENT_SEARCH_ENTITY_TYPE } from './search.constants';
import { SearchIndexService } from './search-index.service';
import type { SearchIndexTx } from './search.types';

@Injectable()
export class EquipmentSearchProjector {
  constructor(private readonly searchIndex: SearchIndexService) {}

  async upsertEquipment(tx: SearchIndexTx, equipmentId: number) {
    const equipment = await tx.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        manufacturer: true,
        responsibleEmployee: true,
        section: {
          include: {
            workshop: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipment not found for search indexing.');
    }

    const responsibleName = [
      equipment.responsibleEmployee.lastName,
      equipment.responsibleEmployee.firstName,
      equipment.responsibleEmployee.middleName,
    ]
      .filter(Boolean)
      .join(' ');

    const subtitle = [
      equipment.inventoryNumber,
      equipment.section.name,
      equipment.serialNumber,
    ]
      .filter(Boolean)
      .join(' · ');

    const searchText = normalizeSearchText([
      equipment.name,
      equipment.inventoryNumber,
      removeInventorySeparators(equipment.inventoryNumber),
      equipment.model,
      equipment.manufacturer?.name,
      equipment.serialNumber,
      equipment.section.workshop.name,
      equipment.section.name,
      responsibleName,
    ]);

    return this.searchIndex.upsert(tx, {
      entityType: EQUIPMENT_SEARCH_ENTITY_TYPE,
      entityId: equipment.id,
      title: equipment.name,
      subtitle,
      searchText,
      isActive: true,
    });
  }
}
