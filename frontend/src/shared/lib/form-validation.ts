export type FieldErrors<FormShape> = Partial<Record<keyof FormShape, string>>;

export type ValidationResult<FormShape> = {
  fieldErrors: FieldErrors<FormShape>;
  formError: string | null;
};

export type ValidationRule<FormShape> = {
  field: keyof FormShape;
  message: string;
  trigger: (form: FormShape) => boolean;
};

const DEFAULT_FORM_ERROR =
  'Проверьте выделенные поля и попробуйте сохранить еще раз.';

export function validateForm<FormShape>(
  form: FormShape,
  rules: ValidationRule<FormShape>[],
  formError = DEFAULT_FORM_ERROR,
): ValidationResult<FormShape> {
  const fieldErrors: FieldErrors<FormShape> = {};

  for (const rule of rules) {
    if (fieldErrors[rule.field]) {
      continue;
    }

    if (rule.trigger(form)) {
      fieldErrors[rule.field] = rule.message;
    }
  }

  return {
    fieldErrors,
    formError: Object.keys(fieldErrors).length ? formError : null,
  };
}

export function isBlank(value: string | null | undefined) {
  return !value?.trim();
}

export function isLongerThan(value: string | null | undefined, maxLength: number) {
  return (value?.trim().length ?? 0) > maxLength;
}

export function isNotPositiveInteger(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return false;
  }

  const numericValue = Number(cleanValue);
  return !Number.isInteger(numericValue) || numericValue <= 0;
}

export function isYearOutsideRange(
  value: string | null | undefined,
  minYear: number,
  maxYear: number,
) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return false;
  }

  const year = Number(cleanValue);
  return !/^\d{4}$/.test(cleanValue) || year < minYear || year > maxYear;
}

export function isInvalidRuDate(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return false;
  }

  const match = cleanValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return true;
  }

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  );
}
