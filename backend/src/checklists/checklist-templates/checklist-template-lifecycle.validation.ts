import {
  ensurePayload,
  parseOptionalString,
} from '../checklist-common/checklists.validation';
import type {
  ArchiveTemplateDto,
  CopyTemplateDto,
  TemplateMutationVersionDto,
} from './checklist-templates.dto';
import { parseTemplateName } from './checklist-template.validation';
import { parseRequiredVersion } from './checklist-template-validation.utils';

export function parseTemplateMutationVersionDto(
  dto: TemplateMutationVersionDto | undefined,
) {
  const payload = ensurePayload(dto, 'Передайте версию шаблона.');

  return {
    version: parseRequiredVersion(payload.version),
  };
}

export function parseCopyTemplateDto(dto: CopyTemplateDto | undefined) {
  const payload = ensurePayload(dto, 'Передайте данные копии шаблона.');

  return {
    name: parseTemplateName(payload.name),
  };
}

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
