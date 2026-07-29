import type {
  CancelEventData,
  CompleteEventData,
  StartEventData,
} from './events-lifecycle.types';
import {
  parsePositiveInteger,
  parseRequiredDate,
} from './events.validation.parsers';
import type {
  CancelEventDto,
  CompleteEventDto,
  StartEventDto,
} from './events.validation.types';

export function parseStartEventDto(
  dto: StartEventDto | undefined,
): StartEventData {
  const body = dto ?? {};

  return {
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}

export function parseCompleteEventDto(
  dto: CompleteEventDto | undefined,
): CompleteEventData {
  const body = dto ?? {};

  return {
    factDate:
      body.factDate === undefined ||
      body.factDate === null ||
      body.factDate === ''
        ? undefined
        : parseRequiredDate(
            body.factDate,
            'FACT_DATE_INVALID',
            'Некорректная фактическая дата.',
          ),
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}

export function parseCancelEventDto(
  dto: CancelEventDto | undefined,
): CancelEventData {
  const body = dto ?? {};

  return {
    version: parsePositiveInteger(
      body.version,
      'VERSION_REQUIRED',
      'Укажите версию события.',
    ),
  };
}
