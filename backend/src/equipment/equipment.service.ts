import { Injectable } from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentHistoryService } from './equipment-history.service';
import { EquipmentQueryService } from './equipment-query.service';
import { EquipmentWriteService } from './equipment-write.service';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly history: EquipmentHistoryService,
    private readonly query: EquipmentQueryService,
    private readonly write: EquipmentWriteService,
  ) {}

  findAll() {
    return this.query.findAll();
  }

  getCreateOptions() {
    return this.query.getCreateOptions();
  }

  findOneByVisibleId(visibleId: number) {
    return this.query.findOneByVisibleId(visibleId);
  }

  findHistoryByVisibleId(visibleId: number) {
    return this.history.findHistoryByVisibleId(visibleId);
  }

  findStorageOwnerByVisibleId(visibleId: number) {
    return this.query.findStorageOwnerByVisibleId(visibleId);
  }

  create(dto: CreateEquipmentDto, userId?: string | null) {
    return this.write.create(dto, userId);
  }

  update(visibleId: number, dto: CreateEquipmentDto, userId?: string | null) {
    return this.write.update(visibleId, dto, userId);
  }
}
