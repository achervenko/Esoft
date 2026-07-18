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
  return value === null ? 'Не указан' : String(value);
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

export function formatQuestionCount(count: number) {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits !== 11 && lastDigit === 1) {
    return `${count} вопрос`;
  }

  if (
    (lastTwoDigits < 12 || lastTwoDigits > 14) &&
    lastDigit >= 2 &&
    lastDigit <= 4
  ) {
    return `${count} вопроса`;
  }

  return `${count} вопросов`;
}

export function formatModuleCount(count: number) {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits !== 11 && lastDigit === 1) {
    return `${count} модуль`;
  }

  if (
    (lastTwoDigits < 12 || lastTwoDigits > 14) &&
    lastDigit >= 2 &&
    lastDigit <= 4
  ) {
    return `${count} модуля`;
  }

  return `${count} модулей`;
}
