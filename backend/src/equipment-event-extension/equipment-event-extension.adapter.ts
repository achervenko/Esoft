import { Injectable } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import type {
  CreateEventChecklistsHandler,
  EventExtensionAdapter,
  EventExtensionPresenterRecord,
} from '../events/event-extensions/event-extension.adapter';
import type { EventCreateOptions } from '../events/events-create.types';
import type { EventUpdateExtensionOptionsResolver } from '../events/events-update.types';
import type {
  EquipmentEventExtensionCreateInput,
  EquipmentEventExtensionUpdateInput,
  PreparedEquipmentEventExtensionCreate,
} from './equipment-event-extension.command.types';
import { EquipmentEventExtensionCreate } from './equipment-event-extension.create';
import type {
  EquipmentEventExtensionDetailResponse,
  EquipmentEventExtensionListResponse,
} from './equipment-event-extension.presenter.types';
import {
  toEquipmentEventExtensionDetailResponse,
  toEquipmentEventExtensionListResponse,
} from './equipment-event-extension.presenter';
import { EquipmentEventExtensionQuery } from './equipment-event-extension.query';
import type {
  EquipmentEventExtensionDetailRecord,
  EquipmentEventExtensionListRecord,
} from './equipment-event-extension.relations';
import { EquipmentEventExtensionUpdate } from './equipment-event-extension.update';
import { EquipmentEventExtensionValidation } from './equipment-event-extension.validation';

@Injectable()
export class EquipmentEventExtensionAdapter
  implements
    EventExtensionAdapter<
      EquipmentEventExtensionCreateInput,
      EquipmentEventExtensionUpdateInput,
      PreparedEquipmentEventExtensionCreate,
      EquipmentEventExtensionDetailResponse,
      EquipmentEventExtensionListResponse
    >
{
  readonly code = EventExtensionCode.EQUIPMENT;

  constructor(
    private readonly create: EquipmentEventExtensionCreate,
    private readonly update: EquipmentEventExtensionUpdate,
    private readonly query: EquipmentEventExtensionQuery,
    private readonly validation: EquipmentEventExtensionValidation,
  ) {}

  assertNoLegacyFields(body: Record<string, unknown>): void {
    this.validation.assertNoLegacyFields(body);
  }

  buildCreateOptions(params: {
    createChecklists: CreateEventChecklistsHandler;
    extension: EquipmentEventExtensionCreateInput;
    userId: string;
  }): EventCreateOptions<PreparedEquipmentEventExtensionCreate> {
    return this.create.buildCreateOptions(params);
  }

  buildListWhere(params: {
    extensionCode: EventExtensionCode | null | undefined;
    query: Record<string, unknown>;
  }): Prisma.EventWhereInput | null {
    return this.query.buildListWhere(params);
  }

  buildUpdateOptionsResolver(params: {
    extension: EquipmentEventExtensionUpdateInput;
    userId?: string | null;
  }): EventUpdateExtensionOptionsResolver {
    return this.update.buildUpdateOptionsResolver(params);
  }

  getDetailSelect(): Prisma.EventSelect {
    return this.query.getDetailSelect();
  }

  getListSelect(): Prisma.EventSelect {
    return this.query.getListSelect();
  }

  hasExtensionRecord(event: EventExtensionPresenterRecord): boolean {
    return this.query.hasExtensionRecord(event);
  }

  parseCreateExtension(value: unknown): EquipmentEventExtensionCreateInput {
    return this.validation.parseCreateExtension(value);
  }

  parseUpdateExtension(value: unknown): EquipmentEventExtensionUpdateInput {
    return this.validation.parseUpdateExtension(value);
  }

  presentDetail(
    event: EventExtensionPresenterRecord,
  ): EquipmentEventExtensionDetailResponse {
    return toEquipmentEventExtensionDetailResponse(
      this.query.getEquipmentExtension<EquipmentEventExtensionDetailRecord>(
        event,
      ),
    );
  }

  presentList(
    event: EventExtensionPresenterRecord,
  ): EquipmentEventExtensionListResponse {
    return toEquipmentEventExtensionListResponse(
      this.query.getEquipmentExtension<EquipmentEventExtensionListRecord>(
        event,
      ),
    );
  }
}
