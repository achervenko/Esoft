import { BadRequestException } from '@nestjs/common';
import { CreateEquipmentDto } from './dto/create-equipment.dto';

export function buildEquipmentData(dto: CreateEquipmentDto) {
  const name = dto.name?.trim();
  const inventoryNumber = dto.inventoryNumber?.trim();

  if (!name) {
    throw new BadRequestException('Название оборудования обязательно.');
  }

  if (!inventoryNumber) {
    throw new BadRequestException('Инвентарный номер обязателен.');
  }

  if (!dto.sectionId) {
    throw new BadRequestException('Местонахождение обязательно.');
  }

  if (!dto.responsibleEmployeeId) {
    throw new BadRequestException('Ответственный обязателен.');
  }

  if (dto.responsibleEmployeeId && !dto.issueDate?.trim()) {
    throw new BadRequestException(
      'Дата выдачи обязательна при назначении ответственного.',
    );
  }

  if (!dto.status) {
    throw new BadRequestException('Статус обязателен.');
  }

  const manufactureYear = toNullableNumber(dto.manufactureYear);
  const commissioningDate = parseRuDate(dto.commissioningDate);
  const issueDate = parseRuDate(dto.issueDate);

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

  return {
    name,
    inventoryNumber,
    serialNumber: toSerialNumber(dto.serialNumber),
    model: toNullableText(dto.model),
    specifications: toNullableText(dto.specifications),
    manufacturerId: toNullableNumber(dto.manufacturerId),
    countryId: toNullableNumber(dto.countryId),
    manufactureYear,
    commissioningDate,
    issueDate,
    sectionId: dto.sectionId,
    responsibleEmployeeId: dto.responsibleEmployeeId,
    status: dto.status,
    operationText: toNullableText(dto.operationText),
    notes: toNullableText(dto.notes),
  };
}

export function toNullableText(value: string | null | undefined) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

export function toSerialNumber(value: string | null | undefined) {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : 'б/н';
}

export function toNullableNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseRuDate(value: string | null | undefined) {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return null;
  }

  const match = cleanValue.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    throw new BadRequestException('Дата должна быть в формате ДД.ММ.ГГГГ.');
  }

  const [, day, month, year] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
