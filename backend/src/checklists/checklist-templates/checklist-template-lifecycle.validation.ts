import {
  ensurePayload,
  parseRequiredString,
} from '../checklist-common/checklists.validation';
import type { ArchiveTemplateDto } from './checklist-templates.dto';
import { parseRequiredVersion } from './checklist-template-validation.utils';

export function parseArchiveTemplateDto(dto: ArchiveTemplateDto | undefined) {
  const payload = ensurePayload(dto, 'Передайте данные удаления.');

  return {
    reason: parseRequiredString(payload.reason, {
      code: 'CHECKLIST_TEMPLATE_ARCHIVE_REASON_REQUIRED',
      maxLength: 500,
      requiredMessage: 'Укажите причину удаления.',
      tooLongCode: 'CHECKLIST_TEMPLATE_ARCHIVE_REASON_TOO_LONG',
      tooLongMessage: 'Причина удаления слишком длинная.',
    }),
    version: parseRequiredVersion(payload.version),
  };
}
