import { Injectable } from '@nestjs/common';
import type { UploadedFileInput } from '../../storage/storage.types';
import { WarehouseStockAdjustmentCommandService } from './adjustment-command.service';
import { WarehouseStockAdjustmentQueryService } from './adjustment-query.service';
import { WarehouseStockAdjustmentDocumentService } from './adjustment-document.service';

@Injectable()
export class WarehouseStockAdjustmentsService {
  constructor(
    private readonly commands: WarehouseStockAdjustmentCommandService,
    private readonly queries: WarehouseStockAdjustmentQueryService,
    private readonly documents: WarehouseStockAdjustmentDocumentService,
  ) {}

  adjustStock(payload: unknown, actorUserId: string) {
    return this.commands.adjustStock(payload, actorUserId);
  }

  get(id: string, actorUserId: string) {
    return this.queries.get(id, actorUserId);
  }

  list(query: unknown, actorUserId: string) {
    return this.queries.list(query, actorUserId);
  }

  uploadDocument(file: UploadedFileInput | undefined, actorUserId: string) {
    return this.documents.uploadDocument(file, actorUserId);
  }
}
