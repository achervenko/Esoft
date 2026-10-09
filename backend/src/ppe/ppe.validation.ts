import { BadRequestException } from '@nestjs/common';
import { PpeItemType } from '@prisma/client';
import { normalizePpeSizeText } from './ppe-size-text';

export const employeeSizeFields = [
  'clothingSize',
  'clothingHeight',
  'shoeSize',
  'gloveSize',
  'headwearSize',
] as const;

export function badPpeRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export function parsePpeObject(
  payload: unknown,
  allowedKeys: readonly string[],
) {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    badPpeRequest('INVALID_PAYLOAD', 'Передайте объект с полями.');
  }
  const values: Record<string, unknown> = Object.fromEntries(
    Object.entries(payload),
  );
  if (Object.keys(values).some((key) => !allowedKeys.includes(key))) {
    badPpeRequest('UNKNOWN_FIELDS', 'Переданы недопустимые поля.');
  }
  return values;
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    badPpeRequest('VALUE_REQUIRED', `Укажите ${label}.`);
  }
  return value.trim();
}

export function parsePpeItem(payload: unknown) {
  const values = parsePpeObject(payload, ['article', 'name', 'unit', 'type']);
  const unit = requiredText(values.unit, 'единицу измерения');
  if (!['шт', 'пары', 'мл'].includes(unit))
    badPpeRequest(
      'INVALID_PPE_UNIT',
      'Выберите единицу измерения: шт, пары или мл.',
    );
  if (
    typeof values.type !== 'string' ||
    !Object.values(PpeItemType).includes(values.type as PpeItemType)
  ) {
    badPpeRequest('INVALID_PPE_ITEM_TYPE', 'Укажите допустимый тип СИЗ.');
  }
  return {
    article: requiredText(values.article, 'артикул'),
    name: requiredText(values.name, 'название'),
    unit,
    type: values.type as PpeItemType,
  };
}

export function parsePpeSize(payload: unknown) {
  const values = parsePpeObject(payload, ['value', 'heightValue']);
  let value = normalizePpeSizeText(requiredText(values.value, 'размер'));
  if (value.includes(';')) {
    const parts = value.split(';');
    if (
      parts.length !== 2 ||
      (values.heightValue !== undefined && values.heightValue !== null)
    )
      badPpeRequest('INVALID_SIZE', 'Укажите одну пару размер;ростовка.');
    value = requiredText(parts[0], 'размер');
    values.heightValue = requiredText(parts[1], 'ростовку');
  }
  if (value.length > 20)
    badPpeRequest('VALUE_TOO_LONG', 'Размер не должен превышать 20 символов.');
  const heightValue =
    values.heightValue === undefined || values.heightValue === null
      ? null
      : normalizePpeSizeText(requiredText(values.heightValue, 'ростовку'));
  if (heightValue !== null && heightValue.length > 20)
    badPpeRequest(
      'VALUE_TOO_LONG',
      'Ростовка не должна превышать 20 символов.',
    );
  return {
    value,
    heightValue,
  };
}

export function parsePpeItemCreate(payload: unknown) {
  const values = parsePpeObject(payload, [
    'article',
    'name',
    'unit',
    'type',
    'sizes',
  ]);
  const { sizes: rawSizes = [], ...itemValues } = values;
  const data = parsePpeItem(itemValues);
  if (!Array.isArray(rawSizes) || rawSizes.length > 2000)
    badPpeRequest(
      'INVALID_PAYLOAD',
      'Передайте список не более 2000 размеров.',
    );
  const sizes = rawSizes.map((raw) => parsePpeSize(raw));
  const seen = new Set<string>();
  for (const size of sizes) {
    assertPpeSizeType(data.type, size.heightValue);
    const key = JSON.stringify([size.value, size.heightValue]);
    if (seen.has(key))
      badPpeRequest('PPE_ITEM_SIZE_CONFLICT', 'Размеры не должны повторяться.');
    seen.add(key);
  }
  return { data, sizes };
}

export function parsePpeSizeSet(payload: unknown) {
  const values = parsePpeObject(payload, ['sizes']);
  if (!Array.isArray(values.sizes) || values.sizes.length > 2000)
    badPpeRequest(
      'INVALID_PAYLOAD',
      'Передайте список не более 2000 размеров.',
    );
  const sizes = values.sizes.map((raw: unknown) => parsePpeSize(raw));
  const keys = sizes.map((size) =>
    JSON.stringify([size.value, size.heightValue]),
  );
  if (new Set(keys).size !== keys.length)
    badPpeRequest('PPE_ITEM_SIZE_CONFLICT', 'Размеры не должны повторяться.');
  return sizes;
}

export function assertPpeSizeType(
  type: PpeItemType,
  heightValue: string | null,
) {
  if (type === PpeItemType.OTHER)
    badPpeRequest(
      'PPE_ITEM_SIZES_NOT_ALLOWED',
      'Для СИЗ типа OTHER размеры не предусмотрены.',
    );
  if (type === PpeItemType.BODY && heightValue === null)
    badPpeRequest(
      'PPE_HEIGHT_REQUIRED',
      'Для одежды укажите размер и ростовку.',
    );
  if (type !== PpeItemType.BODY && heightValue !== null)
    badPpeRequest(
      'PPE_HEIGHT_NOT_ALLOWED',
      'Ростовка предусмотрена только для одежды.',
    );
}

export function parsePpeStatus(payload: unknown) {
  const values = parsePpeObject(payload, ['isActive']);
  if (typeof values.isActive !== 'boolean') {
    badPpeRequest('INVALID_STATUS', 'Статус должен быть логическим значением.');
  }
  return values.isActive;
}

export type EmployeeSizesPatch = Partial<{
  clothingSize: string | null;
  clothingHeight: string | null;
  shoeSize: number | null;
  gloveSize: string | null;
  headwearSize: string | null;
}>;

export function parseEmployeeSizes(payload: unknown): EmployeeSizesPatch {
  const values = parsePpeObject(payload, employeeSizeFields);
  if (Object.keys(values).length === 0) {
    badPpeRequest('EMPTY_PAYLOAD', 'Укажите хотя бы один размер.');
  }
  const result: EmployeeSizesPatch = {};
  for (const key of employeeSizeFields) {
    if (!Object.hasOwn(values, key)) continue;
    const value = values[key];
    if (key === 'shoeSize') {
      if (value === null) result.shoeSize = null;
      else {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 15 ||
          value > 60 ||
          Number(value.toFixed(1)) !== value
        ) {
          badPpeRequest(
            'INVALID_SHOE_SIZE',
            'Размер обуви должен быть числом от 15 до 60 с не более чем одним знаком после запятой.',
          );
        }
        result.shoeSize = value;
      }
    } else if (value === null) result[key] = null;
    else {
      if (typeof value !== 'string')
        badPpeRequest('INVALID_SIZE', 'Размер должен быть строкой или null.');
      const text = normalizePpeSizeText(value.trim());
      if (text.length > 20)
        badPpeRequest(
          'VALUE_TOO_LONG',
          'Размер не должен превышать 20 символов.',
        );
      result[key] = text || null;
    }
  }
  return result;
}
