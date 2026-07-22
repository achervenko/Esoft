import { BadRequestException } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

const MAX_NAME_LENGTH = 128;
const MAX_INVENTORY_NUMBER_LENGTH = 64;
const MAX_SERIAL_NUMBER_LENGTH = 128;
const MAX_TEXT_LENGTH = 4_000;
const MIN_MANUFACTURE_YEAR = 1900;
const MAX_MANUFACTURE_YEAR = 2100;

export function buildEquipmentData(dto: CreateEquipmentDto) {
  const name = parseRequiredText(
    dto.name,
    'Название оборудования обязательно.',
    MAX_NAME_LENGTH,
  );
  const inventoryNumber = parseRequiredText(
    dto.inventoryNumber,
    'Инвентарный номер обязателен.',
    MAX_INVENTORY_NUMBER_LENGTH,
  );
  const modelId = parseRequiredPositiveInteger(
    dto.modelId,
    'Модель обязательна.',
  );
  const sectionId = parseRequiredPositiveInteger(
    dto.sectionId,
    'Местонахождение обязательно.',
  );
  const responsibleEmployeeId = parseRequiredPositiveInteger(
    dto.responsibleEmployeeId,
    'Ответственный обязателен.',
  );
  const status = parseEquipmentStatus(dto.status);
  const manufactureYear = parseManufactureYear(dto.manufactureYear);
  const commissioningDate = parseRuDate(dto.commissioningDate);
  const issueDate = parseRuDate(dto.issueDate);

  if (!issueDate) {
    throw new BadRequestException('Дата выдачи обязательна.');
  }

  if (
    manufactureYear &&
    commissioningDate &&
    commissioningDate.getUTCFullYear() < manufactureYear
  ) {
    throw new BadRequestException(
      'Год ввода в эксплуатацию не может быть меньше года выпуска.',
    );
  }

  if (issueDate && commissioningDate && issueDate < commissioningDate) {
    throw new BadRequestException(
      'Дата выдачи не может быть раньше даты ввода в эксплуатацию.',
    );
  }

  if (
    issueDate &&
    !commissioningDate &&
    manufactureYear &&
    issueDate.getUTCFullYear() < manufactureYear
  ) {
    throw new BadRequestException(
      'Дата выдачи не может быть раньше года выпуска оборудования.',
    );
  }

  return {
    name,
    inventoryNumber,
    serialNumber: toSerialNumber(dto.serialNumber),
    modelId,
    specifications: parseOptionalText(
      dto.specifications,
      'Технические характеристики слишком длинные.',
    ),
    countryId: parseOptionalPositiveInteger(
      dto.countryId,
      'Некорректная страна производства.',
    ),
    manufactureYear,
    commissioningDate,
    issueDate,
    sectionId,
    responsibleEmployeeId,
    status,
    operationText: parseOptionalText(
      dto.operationText,
      'Технологическая операция слишком длинная.',
    ),
    notes: parseOptionalText(dto.notes, 'Примечание слишком длинное.'),
  };
}

export function parseEquipmentVisibleId(value: unknown) {
  return parseOptionalPositiveInteger(value, 'Некорректный ID оборудования.');
}

function parseRequiredText(
  value: unknown,
  requiredMessage: string,
  maxLength: number,
) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(requiredMessage);
  }

  const cleanValue = value.trim();

  if (cleanValue.length > maxLength) {
    throw new BadRequestException(`Максимальная длина: ${maxLength} символов.`);
  }

  return cleanValue;
}

function parseOptionalText(value: unknown, tooLongMessage: string) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Некорректное текстовое значение.');
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  if (cleanValue.length > MAX_TEXT_LENGTH) {
    throw new BadRequestException(tooLongMessage);
  }

  return cleanValue;
}

function toSerialNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Некорректный заводской номер.');
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  if (cleanValue.toLocaleLowerCase('ru-RU') === 'б/н') {
    return null;
  }

  if (cleanValue.length > MAX_SERIAL_NUMBER_LENGTH) {
    throw new BadRequestException(
      `Заводской номер: максимум ${MAX_SERIAL_NUMBER_LENGTH} символов.`,
    );
  }

  return cleanValue;
}

function parseRequiredPositiveInteger(value: unknown, message: string) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new BadRequestException(message);
  }

  return value;
}

function parseOptionalPositiveInteger(value: unknown, message: string) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return parseRequiredPositiveInteger(value, message);
}

function parseManufactureYear(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_MANUFACTURE_YEAR ||
    value > MAX_MANUFACTURE_YEAR
  ) {
    throw new BadRequestException(
      `Год выпуска должен быть от ${MIN_MANUFACTURE_YEAR} до ${MAX_MANUFACTURE_YEAR}.`,
    );
  }

  return value;
}

function parseEquipmentStatus(value: unknown) {
  if (
    typeof value !== 'string' ||
    !(Object.values(EquipmentStatus) as string[]).includes(value)
  ) {
    throw new BadRequestException('Выберите допустимый статус оборудования.');
  }

  return value as EquipmentStatus;
}

function parseRuDate(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Дата должна быть в формате ДД.ММ.ГГГГ.');
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  const match = cleanValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    throw new BadRequestException('Дата должна быть в формате ДД.ММ.ГГГГ.');
  }

  const [, day, month, year] = match;
  const parsedDay = Number(day);
  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));

  if (
    date.getUTCFullYear() !== parsedYear ||
    date.getUTCMonth() !== parsedMonth - 1 ||
    date.getUTCDate() !== parsedDay
  ) {
    throw new BadRequestException('Указана некорректная дата.');
  }

  return date;
}
