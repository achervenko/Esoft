import { BadRequestException } from '@nestjs/common';

const MAX_NAME_LENGTH = 128;

export function parseDictionaryName(payload: { name?: unknown }) {
  if (typeof payload.name !== 'string' || !payload.name.trim()) {
    throw new BadRequestException({
      code: 'DICTIONARY_NAME_REQUIRED',
      message: 'Укажите название.',
    });
  }

  const name = payload.name.trim();

  if (name.length > MAX_NAME_LENGTH) {
    throw new BadRequestException({
      code: 'DICTIONARY_NAME_TOO_LONG',
      message: 'Название слишком длинное.',
    });
  }

  return name;
}

export function parseCountryPayload(payload: {
  iso?: unknown;
  name?: unknown;
}) {
  const name = parseDictionaryName(payload);

  if (typeof payload.iso !== 'string' || !payload.iso.trim()) {
    throw new BadRequestException({
      code: 'COUNTRY_ISO_REQUIRED',
      message: 'Укажите ISO-код страны.',
    });
  }

  const iso = payload.iso.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(iso)) {
    throw new BadRequestException({
      code: 'COUNTRY_ISO_INVALID',
      message: 'ISO-код должен состоять из двух латинских букв.',
    });
  }

  return { iso, name };
}

export function parseLocationPayload(payload: {
  name?: unknown;
  objectId?: unknown;
}) {
  const name = parseDictionaryName(payload);
  const objectId = Number(payload.objectId);

  if (!Number.isInteger(objectId) || objectId <= 0) {
    throw new BadRequestException({
      code: 'DICTIONARY_PARENT_REQUIRED',
      message: 'Укажите объект.',
    });
  }

  return { name, workshopId: objectId };
}
