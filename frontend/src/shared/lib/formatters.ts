export function formatRuDate(value: string | null) {
  if (!value) {
    return 'Не указана';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Не указана';
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

export function formatNullableNumber(value: number | null) {
  return value ? String(value) : 'Не указан';
}

export function formatNullableText(value: string | null, fallback = 'Не указано') {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  if (normalizedValue.toLocaleLowerCase('ru-RU') === 'не указано') {
    return 'Не указано';
  }

  return normalizedValue;
}
