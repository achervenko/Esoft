import { parsePositiveInt } from '../checklist-common/checklists.validation';

export function parseRequiredVersion(value: unknown) {
  return parsePositiveInt(
    value,
    'CHECKLIST_TEMPLATE_VERSION_INVALID',
    'Некорректная версия шаблона.',
  );
}
