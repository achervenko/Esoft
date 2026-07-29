import type { EventExtensionCode, Prisma } from '@prisma/client';
import type { EventCreateOptions } from '../events-create.types';
import type { EventUpdateExtensionOptionsResolver } from '../events-update.types';
import type { EventChecklistAssignment } from '../event-checklists/event-checklists.types';

export type CreateEventChecklistsHandler = (params: {
  assignments: EventChecklistAssignment[];
  createdBy: string;
  eventId: number;
  tx: Prisma.TransactionClient;
}) => Promise<void>;

export type EventExtensionPresenterRecord = {
  extensionCode: EventExtensionCode | null;
  [key: string]: unknown;
};

export type EventExtensionAdapter<
  TCreateExtension,
  TUpdateExtension,
  TCreateExtensionContext,
  TDetailResponse,
  TListResponse,
> = {
  code: EventExtensionCode;
  assertNoLegacyFields(body: Record<string, unknown>): void;
  buildCreateOptions(params: {
    createChecklists: CreateEventChecklistsHandler;
    extension: TCreateExtension;
    userId: string;
  }): EventCreateOptions<TCreateExtensionContext>;
  buildUpdateOptionsResolver(params: {
    extension: TUpdateExtension;
    userId?: string | null;
  }): EventUpdateExtensionOptionsResolver;
  buildListWhere(params: {
    extensionCode: EventExtensionCode | null | undefined;
    query: Record<string, unknown>;
  }): Prisma.EventWhereInput | null;
  getDetailSelect(): Prisma.EventSelect;
  getListSelect(): Prisma.EventSelect;
  hasExtensionRecord(event: EventExtensionPresenterRecord): boolean;
  parseCreateExtension(value: unknown): TCreateExtension;
  parseUpdateExtension(value: unknown): TUpdateExtension;
  presentDetail(event: EventExtensionPresenterRecord): TDetailResponse;
  presentList(event: EventExtensionPresenterRecord): TListResponse;
};

export type AnyEventExtensionAdapter = EventExtensionAdapter<
  unknown,
  unknown,
  unknown,
  unknown,
  unknown
>;

export const EVENT_EXTENSION_ADAPTERS = Symbol('EVENT_EXTENSION_ADAPTERS');
