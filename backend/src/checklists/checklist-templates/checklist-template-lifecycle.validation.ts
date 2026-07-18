import {
  ensurePayload,
  parseOptionalString,
} from '../checklist-common/checklists.validation';
import type { ArchiveTemplateDto } from './checklist-templates.dto';
import { parseRequiredVersion } from './checklist-template-validation.utils';

export function parseArchiveTemplateDto(dto: ArchiveTemplateDto | undefined) {
  const payload = ensurePayload(dto, 'Передайте данные архивирования.');

  return {
    reason: parseOptionalString(payload.reason, {
      maxLength: 1000,
      tooLongCode: 'CHECKLIST_TEMPLATE_ARCHIVE_REASON_TOO_LONG',
      tooLongMessage: 'Причина архивирования слишком длинная.',
    }),
    version: parseRequiredVersion(payload.version),
  };
}
