import { throwEventBadRequest } from './events.errors';
import type { UpdateCreatedEventDto } from './events.validation.types';

export function assertNoUpdateExtensionCode(
  value: UpdateCreatedEventDto['extensionCode'],
): void {
  if (value !== undefined) {
    throwEventBadRequest(
      'EVENT_EXTENSION_CODE_IMMUTABLE',
      'Тип расширения события нельзя изменить.',
    );
  }
}
