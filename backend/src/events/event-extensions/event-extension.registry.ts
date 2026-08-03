import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import { throwEventBadRequest, throwEventConflict } from '../events.errors';
import {
  EVENT_EXTENSION_ADAPTERS,
  type AnyEventExtensionAdapter,
  type EventExtensionPresenterRecord,
} from './event-extension.adapter';

const EVENT_EXTENSION_CODES = new Set<EventExtensionCode>(
  Object.values(EventExtensionCode),
);

@Injectable()
export class EventExtensionRegistry {
  private readonly adaptersByCode = new Map<
    EventExtensionCode,
    AnyEventExtensionAdapter
  >();

  constructor(
    @Optional()
    @Inject(EVENT_EXTENSION_ADAPTERS)
    adapters: AnyEventExtensionAdapter[] = [],
  ) {
    for (const adapter of adapters) {
      if (this.adaptersByCode.has(adapter.code)) {
        throw new Error(
          `Duplicate event extension adapter registered: ${adapter.code}.`,
        );
      }

      this.adaptersByCode.set(adapter.code, adapter);
    }
  }

  assertNoLegacyFields(body: Record<string, unknown>): void {
    for (const adapter of this.adaptersByCode.values()) {
      adapter.assertNoLegacyFields(body);
    }
  }

  buildListWhere(params: {
    extensionCode: EventExtensionCode | null | undefined;
    query: Record<string, unknown>;
  }): Prisma.EventWhereInput {
    let where: Prisma.EventWhereInput = {};

    for (const adapter of this.adaptersByCode.values()) {
      where = {
        ...where,
        ...(adapter.buildListWhere(params) ?? {}),
      };
    }

    return where;
  }

  getAdapter(code: EventExtensionCode): AnyEventExtensionAdapter {
    const adapter = this.adaptersByCode.get(code);

    if (!adapter) {
      throwEventConflict(
        'EVENT_EXTENSION_UNSUPPORTED',
        'Тип расширения события не поддерживается.',
      );
    }

    return adapter;
  }

  getDetailSelect(): Prisma.EventSelect {
    return this.mergeSelects((adapter) => adapter.getDetailSelect());
  }

  getListSelect(): Prisma.EventSelect {
    return this.mergeSelects((adapter) => adapter.getListSelect());
  }

  hasAnyExtensionRecord(event: EventExtensionPresenterRecord): boolean {
    for (const adapter of this.adaptersByCode.values()) {
      if (adapter.hasExtensionRecord(event)) {
        return true;
      }
    }

    return false;
  }

  parseCreateExtensionCode(value: unknown): EventExtensionCode | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (!this.isEventExtensionCode(value)) {
      throwEventBadRequest(
        'EVENT_EXTENSION_CODE_INVALID',
        'Некорректный тип расширения события.',
      );
    }

    this.getAdapter(value);

    return value;
  }

  parseCreateExtension(
    value: unknown,
    extensionCode: EventExtensionCode | null,
  ): unknown {
    if (extensionCode === null) {
      if (value !== undefined) {
        throwEventBadRequest(
          'EVENT_EXTENSION_UNEXPECTED',
          'Для события без типа расширения нельзя передавать данные расширения.',
        );
      }

      return undefined;
    }

    return this.getAdapter(extensionCode).parseCreateExtension(value);
  }

  presentDetail(
    extensionCode: EventExtensionCode | null,
    event: EventExtensionPresenterRecord,
  ): unknown {
    if (extensionCode === null) {
      this.assertNoExtensionRecord(event);

      return null;
    }

    return this.getAdapter(extensionCode).presentDetail(event);
  }

  presentList(
    extensionCode: EventExtensionCode | null,
    event: EventExtensionPresenterRecord,
  ): unknown {
    if (extensionCode === null) {
      this.assertNoExtensionRecord(event);

      return null;
    }

    return this.getAdapter(extensionCode).presentList(event);
  }

  private isEventExtensionCode(value: unknown): value is EventExtensionCode {
    return (
      typeof value === 'string' &&
      EVENT_EXTENSION_CODES.has(value as EventExtensionCode)
    );
  }

  private mergeSelects(
    getSelect: (adapter: AnyEventExtensionAdapter) => Prisma.EventSelect,
  ): Prisma.EventSelect {
    let select: Prisma.EventSelect = {};

    for (const adapter of this.adaptersByCode.values()) {
      select = {
        ...select,
        ...getSelect(adapter),
      };
    }

    return select;
  }

  private assertNoExtensionRecord(event: EventExtensionPresenterRecord): void {
    if (!this.hasAnyExtensionRecord(event)) {
      return;
    }

    throwEventConflict(
      'EVENT_EXTENSION_CONFLICT',
      'Данные расширения события не соответствуют его типу.',
    );
  }
}
